import 'dotenv/config';
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let firebaseAdminInitialized = false;

async function initFirebaseAdmin() {
  if (firebaseAdminInitialized) return;

  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID;

    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.projectId && config.projectId !== 'PLACEHOLDER') {
        projectId = config.projectId;
      }
    }

    if (projectId) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectId
      });
      firebaseAdminInitialized = true;
      console.log(`Firebase Admin initialized for project: ${projectId}`);
    } else {
      console.warn("Firebase Admin not initialized: No Project ID found.");
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
    // Fallback for local development if applicationDefault() fails
    try {
       admin.initializeApp();
       firebaseAdminInitialized = true;
    } catch (e) {
       console.error("Final fallback for Firebase Admin failed:", e);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3002;

  app.use(express.json());

  await initFirebaseAdmin();

  // API Routes
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });
  
  // Helper for consistent error responses
  const sendError = (res: express.Response, status: number, message: string, code?: string) => {
    return res.status(status).json({ 
      success: false, 
      message, 
      code: code || 'internal-error' 
    });
  };

  // Check if user exists in Auth
  app.get("/api/admin/auth/check", async (req, res) => {
    const { email, uid } = req.query;
    if (!firebaseAdminInitialized) {
      return sendError(res, 503, "Firebase Admin not initialized. Please check configuration.");
    }

    try {
      let userRecord;
      if (uid) {
        userRecord = await admin.auth().getUser(uid as string);
      } else if (email) {
        userRecord = await admin.auth().getUserByEmail(email as string);
      }

      if (userRecord) {
        return res.json({
          exists: true,
          uid: userRecord.uid,
          email: userRecord.email,
          disabled: userRecord.disabled,
          lastSignInTime: userRecord.metadata.lastSignInTime
        });
      }
      res.json({ exists: false });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return res.json({ exists: false });
      }
      console.error("Error checking auth user:", error);
      sendError(res, 500, error.message, error.code);
    }
  });

  // Create Auth User
  app.post("/api/admin/auth/create", async (req, res) => {
    const { userId, email, password, nome, sobrenome, adminEmail, organizationId } = req.body;
    
    if (!firebaseAdminInitialized) {
      return sendError(res, 503, "Firebase Admin not initialized. Please check configuration.");
    }

    if (!email || !password || !userId) {
      return sendError(res, 400, "Dados insuficientes para criar acesso (email, senha e ID do usuário são obrigatórios).");
    }

    let userRecord;
    let createdNewAuth = false;

    try {
      const db = admin.firestore();
      const userRef = db.collection('usuarios').doc(userId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return sendError(res, 404, "Usuário não encontrado no Firestore.");
      }

      const userData = userSnap.data();
      if (userData?.hasAccess) {
        return sendError(res, 400, "Este usuário já possui acesso configurado.");
      }

      // 1. Check if email already exists in Auth
      try {
        userRecord = await admin.auth().getUserByEmail(email);
        
        // If exists, check if another Firestore user is already using this UID
        const otherUserQuery = await db.collection('usuarios').where('uid', '==', userRecord.uid).get();
        if (!otherUserQuery.empty) {
          return sendError(res, 400, "Este email já está vinculado a outro usuário cadastrado.");
        }
        console.log(`Email ${email} already exists in Auth but is not linked. Linking to user ${userId}.`);
      } catch (authError: any) {
        if (authError.code === 'auth/user-not-found') {
          // 2. Create user in Firebase Auth if not exists
          userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: `${nome} ${sobrenome}`.trim(),
            emailVerified: true
          });
          createdNewAuth = true;
        } else {
          throw authError;
        }
      }

      // 3. Update Firestore with the new UID and access metadata
      try {
        await userRef.update({
          uid: userRecord.uid,
          emailLogin: email,
          hasAccess: true,
          accessCreatedBy: adminEmail || 'admin@indika.com',
          accessCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
          mustChangePassword: true,
          organizationId: organizationId || 'default-org',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (firestoreError) {
        // ROLLBACK: If Firestore fails, delete the Auth user we just created
        if (createdNewAuth && userRecord) {
          console.error("Firestore update failed. Rolling back Auth user creation.");
          await admin.auth().deleteUser(userRecord.uid);
        }
        throw firestoreError;
      }

      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error("Error in production auth creation:", error);
      let message = error.message;
      if (error.code === 'auth/email-already-exists') {
        message = "Este email já está em uso por outra conta.";
      } else if (error.code === 'auth/invalid-password') {
        message = "A senha deve ter pelo menos 6 caracteres.";
      }
      sendError(res, 500, message, error.code);
    }
  });

  // Update Auth User
  app.post("/api/admin/auth/update", async (req, res) => {
    const { uid, email, password, disabled, action } = req.body;
    if (!firebaseAdminInitialized) {
      return sendError(res, 503, "Firebase Admin not initialized.");
    }

    if (!uid) {
      return sendError(res, 400, "UID do usuário é obrigatório.");
    }

    try {
      const updateData: any = {};
      if (action === 'email') {
        if (!email) return sendError(res, 400, "Email é obrigatório para atualização.");
        updateData.email = email;
      }
      if (action === 'password') {
        if (!password) return sendError(res, 400, "Senha é obrigatória para atualização.");
        updateData.password = password;
      }
      if (action === 'status') {
        updateData.disabled = disabled;
      }

      await admin.auth().updateUser(uid, updateData);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating auth user:", error);
      sendError(res, 500, error.message, error.code);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

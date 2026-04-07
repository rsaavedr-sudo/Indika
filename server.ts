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
  const PORT = 3000;

  app.use(express.json());

  await initFirebaseAdmin();

  // API Routes
  
  // Check if user exists in Auth
  app.get("/api/admin/auth/check", async (req, res) => {
    const { email, uid } = req.query;
    if (!firebaseAdminInitialized) return res.status(500).json({ message: "Firebase Admin not initialized" });

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
      res.status(500).json({ message: error.message });
    }
  });

  // Create Auth User
  app.post("/api/admin/auth/create", async (req, res) => {
    const { userId, email, password, nome, sobrenome } = req.body;
    if (!firebaseAdminInitialized) return res.status(500).json({ message: "Firebase Admin not initialized" });

    try {
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: `${nome} ${sobrenome}`,
        emailVerified: true
      });

      // Update Firestore with the new UID
      const db = admin.firestore();
      await db.collection('usuarios').doc(userId).update({
        uid: userRecord.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error("Error creating auth user:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update Auth User
  app.post("/api/admin/auth/update", async (req, res) => {
    const { uid, email, password, disabled, action } = req.body;
    if (!firebaseAdminInitialized) return res.status(500).json({ message: "Firebase Admin not initialized" });

    try {
      const updateData: any = {};
      if (action === 'email') updateData.email = email;
      if (action === 'password' && password) updateData.password = password;
      if (action === 'status') updateData.disabled = disabled;

      await admin.auth().updateUser(uid, updateData);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating auth user:", error);
      res.status(500).json({ message: error.message });
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

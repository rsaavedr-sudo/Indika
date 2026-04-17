/**
 * One-time script to set custom claims (role: 'admin') for all users
 * whose Firestore profile has role === 'admin'.
 *
 * Run: node set-admin-claims.js
 */

const admin = require('firebase-admin');

// Try to load service account, fallback to application default credentials
let initialized = false;
try {
  const sa = require('./service-account.json');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  initialized = true;
  console.log('Using service-account.json');
} catch (e) {
  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    initialized = true;
    console.log('Using application default credentials');
  } catch (e2) {
    console.error('Could not initialize Firebase Admin. Make sure service-account.json exists or GOOGLE_APPLICATION_CREDENTIALS is set.');
    process.exit(1);
  }
}

const db = admin.firestore();

async function syncAdminClaims() {
  console.log('\n=== Syncing admin custom claims ===\n');

  // Find all users with role: 'admin' in Firestore
  const snapshot = await db.collection('usuarios').where('role', '==', 'admin').get();

  if (snapshot.empty) {
    console.log('No admin users found in Firestore.');
    return;
  }

  console.log(`Found ${snapshot.size} admin user(s):\n`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const uid = data.uid;
    const email = data.emailLogin || data.email || '(no email)';

    if (!uid) {
      console.log(`  ⚠ Skipping doc ${doc.id} — no uid field`);
      continue;
    }

    try {
      await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
      console.log(`  ✓ Set role:admin for ${email} (uid: ${uid})`);
    } catch (err) {
      console.log(`  ✗ Failed for ${email} (uid: ${uid}): ${err.message}`);
    }
  }

  console.log('\n✅ Done! Users must sign out and sign back in for claims to take effect.\n');
  process.exit(0);
}

syncAdminClaims().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';

const PROJECT_ID = 'indika-985c9';

let credential;
if (existsSync('./service-account.json')) {
  const sa = JSON.parse(readFileSync('./service-account.json', 'utf8'));
  credential = admin.credential.cert(sa);
  console.log('Using service-account.json');
} else {
  credential = admin.credential.applicationDefault();
  console.log('Using application default credentials (gcloud)');
}

admin.initializeApp({ credential, projectId: PROJECT_ID });
const db = admin.firestore();

async function syncAdminClaims() {
  console.log('\n=== Syncing admin custom claims ===\n');

  const snapshot = await db.collection('usuarios').where('role', '==', 'admin').get();

  if (snapshot.empty) {
    console.log('No admin users found in Firestore.');
    process.exit(0);
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

  console.log('\n✅ Done! Sign out and sign back in for claims to take effect.\n');
  process.exit(0);
}

syncAdminClaims().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

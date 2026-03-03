const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyA6r79XcsMr3KZUT1YZ8vQntIGspgULXcE",
    authDomain: "rpg-lendasereliquias.firebaseapp.com",
    projectId: "rpg-lendasereliquias",
    storageBucket: "rpg-lendasereliquias.firebasestorage.app",
    messagingSenderId: "546994339773",
    appId: "1:546994339773:web:0116cf7c8667f113075cd4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
    console.log("Fetching races...");
    const snap = await getDocs(collection(db, 'system/data/races'));
    let found = false;
    snap.forEach(doc => {
        if (!found) {
            console.log(doc.id, "=>", doc.data());
            found = true;
        }
    });

    console.log("Fetching peculiarities...");
    const snap2 = await getDocs(collection(db, 'system/data/peculiarities'));
    let found2 = false;
    snap2.forEach(doc => {
        if (!found2) {
            console.log(doc.id, "=>", doc.data());
            found2 = true;
        }
    });
    process.exit(0);
}

test().catch(console.error);

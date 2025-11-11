// firebase.js - initialize Firebase (compat) and expose db as window.db
const firebaseConfig = {
    apiKey: "AIzaSyCqbDmeB6hrJ3NmwfPWakxg4z31UwudZ5c",
    authDomain: "footballleague-b89e5.firebaseapp.com",
    projectId: "footballleague-b89e5",
    storageBucket: "footballleague-b89e5.firebasestorage.app",
    messagingSenderId: "345929896639",
    appId: "1:345929896639:web:25e2a47c96a42d5307ac0a",
    measurementId: "G-2S5YYMKYCE"
};

// Initialize Firebase compat (CDN must be loaded in HTML before this)
if (typeof firebase === "undefined") {
    console.error("Firebase SDK not loaded. Make sure you included the compat scripts in the HTML.");
} else {
    try {
        firebase.initializeApp(firebaseConfig);
        window.db = firebase.firestore();
        console.log("Firebase initialized, Firestore ready.");
    } catch (e) {
        console.error("Firebase init error:", e);
    }
}
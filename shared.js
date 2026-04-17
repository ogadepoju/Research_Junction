// shared.js — Firebase init + shared utilities for Research Junction
// Loaded by all pages before page-specific scripts

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAJfy7YT86H6eXVnZtMdyNtMhTPB80LLsI",
    authDomain: "insight-3bbec.firebaseapp.com",
    projectId: "insight-3bbec",
    storageBucket: "insight-3bbec.firebasestorage.app",
    messagingSenderId: "582201121128",
    appId: "1:582201121128:web:f61c6323e8ac039524dedd",
    databaseURL: "https://insight-3bbec-default-rtdb.firebaseio.com"
};

// Initialize only once
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
}
if (typeof firebase !== 'undefined') {
    window.db = firebase.database();
}

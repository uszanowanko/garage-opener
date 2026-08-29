// UI strings. Add a language by adding a top-level key; the language switcher
// and auto-detection pick it up automatically. {placeholders} are filled at
// runtime. Missing keys fall back to English, then to the key name.

window.GARAGE_I18N = {
  en: {
    "lang.name": "English",

    "invite.title": "This device isn't set up yet.",
    "invite.body": "Open the personal link {admin} sent you — it sets this up automatically. Then use Share → Add to Home Screen so it's one tap.",
    "invite.adminFallback": "the owner",
    "invite.manual": "set up manually",

    "setup.intro": "Manual setup. The key is stored only in this browser and is never uploaded.",
    "setup.name": "Name (must match the roster)",
    "setup.key": "Key — 64 hex characters",
    "setup.save": "Save",
    "setup.errName": "Name: 1–31 characters, no ';' or ':'.",
    "setup.errKey": "The key must be 64 hex characters.",

    "app.open": "Open",
    "app.sending": "Sending…",
    "app.sent": "Sent. Opening…",
    "app.failed": "Failed: {msg}",
    "app.recent": "Recent",
    "app.refresh": "Refresh",
    "app.loading": "Loading…",
    "app.noRecent": "Nothing in the last 12 h.",
    "app.histError": "Couldn't load history.",
    "app.retention": "History is kept about 12 h.",
    "app.signedInAs": "Signed in as {name}",
    "app.reset": "reset this device",
    "app.resetConfirm": "Reset this device? You'll need your personal link again.",

    "time.justNow": "just now",
    "time.minAgo": "{n} min ago",
    "time.hAgo": "{n} h ago",
  },

  pl: {
    "lang.name": "Polski",

    "invite.title": "To urządzenie nie jest jeszcze skonfigurowane.",
    "invite.body": "{admin} wysłał(a) Ci osobisty link — otwórz go i konfiguracja wykona się sama. Potem użyj Udostępnij → Dodaj do ekranu początkowego, aby otwierać jednym dotknięciem.",
    "invite.adminFallback": "właściciel",
    "invite.manual": "konfiguracja ręczna",

    "setup.intro": "Konfiguracja ręczna. Klucz jest przechowywany tylko w tej przeglądarce i nigdy nie jest wysyłany.",
    "setup.name": "Imię (musi być na liście)",
    "setup.key": "Klucz — 64 znaki szesnastkowe",
    "setup.save": "Zapisz",
    "setup.errName": "Imię: 1–31 znaków, bez ';' i ':'.",
    "setup.errKey": "Klucz musi mieć 64 znaki szesnastkowe.",

    "app.open": "Otwórz",
    "app.sending": "Wysyłanie…",
    "app.sent": "Wysłano. Otwieram…",
    "app.failed": "Błąd: {msg}",
    "app.recent": "Ostatnie",
    "app.refresh": "Odśwież",
    "app.loading": "Ładowanie…",
    "app.noRecent": "Nic w ciągu ostatnich 12 godz.",
    "app.histError": "Nie udało się wczytać historii.",
    "app.retention": "Historia jest przechowywana ok. 12 godz.",
    "app.signedInAs": "Zalogowano jako {name}",
    "app.reset": "zresetuj to urządzenie",
    "app.resetConfirm": "Zresetować to urządzenie? Będzie potrzebny ponownie osobisty link.",

    "time.justNow": "przed chwilą",
    "time.minAgo": "{n} min temu",
    "time.hAgo": "{n} godz. temu",
  },
};

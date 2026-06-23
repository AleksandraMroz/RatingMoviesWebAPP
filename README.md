# Filmoteka

Webowa aplikacja do śledzenia i analizowania aktywności filmowej użytkownika z wykorzystaniem API TMDB.

## Wymagania

- Node.js w wersji 18 lub nowszej
- Konto MongoDB Atlas (lub lokalna instancja MongoDB)
- Klucz API TMDB (themoviedb.org)

## Instalacja

1. Rozpakuj archiwum projektu.
2. W katalogu projektu zainstaluj zależności:

```
npm install
```

3. Utwórz plik `.env` w głównym katalogu projektu i uzupełnij go następującymi wartościami:

```
MONGODB_URI=twoj_connection_string_mongodb
JWT_SECRET=twoj_tajny_klucz_jwt
SESSION_SECRET=twoj_tajny_klucz_sesji
```

4. Uruchom aplikację:

```
node app.js
```

lub z automatycznym restartem przy zmianach:

```
npx nodemon app.js
```

5. Otwórz przeglądarkę i przejdź pod adres:

```
http://localhost:5000
```

## Struktura projektu

```
├── app.js                  # Punkt wejściowy aplikacji
├── package.json            # Zależności projektu
├── server/
│   ├── config/             # Konfiguracja bazy danych
│   ├── models/             # Modele Mongoose
│   ├── routes/             # Trasy Express
│   ├── helpers/            # Funkcje pomocnicze
│   └── achievements.js     # Logika osiągnięć
├── views/                  # Szablony EJS
└── public/                 # Pliki statyczne (CSS, JS, grafiki)
```

## Klucz API TMDB

Klucz API TMDB jest wbudowany w kod aplikacji i nie wymaga dodatkowej konfiguracji.

## Technologie

Node.js, Express.js, MongoDB, Mongoose, D3.js, EJS, JWT, Multer, TMDB API

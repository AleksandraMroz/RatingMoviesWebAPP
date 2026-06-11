const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');
require("dotenv").config();

const express = require("express");
const expressLayout = require("express-ejs-layouts");
const methodOverride = require("method-override");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const MongoStore = require("connect-mongo");

const connectDB = require("./server/config/db");
const { isActiveRoute } = require("./server/helpers/routeHelpers");

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(methodOverride("_method"));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
    }),
  })
);

app.use((req, res, next) => {
  res.locals.isLoggedIn = req.session.isLoggedIn;
  next();
});
app.use(express.static("public"));
app.use("/uploads", express.static("public/uploads"));

app.use(expressLayout);
app.set("layout", "./layouts/main");
app.set("view engine", "ejs");

app.locals.isActiveRoute = isActiveRoute;

app.use("/", require("./server/routes/main"));
app.use("/", require("./server/routes/admin"));

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});

const express = require("express");
const router = express.Router();

// ℹ️ Handles password encryption
const bcrypt = require("bcrypt");

// ℹ️ Handles password encryption
const jwt = require("jsonwebtoken");

// Require the User model in order to interact with the database
const User = require("../models/User.model");

const Clothing = require("../models/Clothing.model");

// Require necessary (isAuthenticated) middleware in order to control access to specific routes
const { isAuthenticated } = require("../middleware/jwt.middleware.js");
const { response } = require("../app");

// How many rounds should bcrypt run the salt (default - 10 rounds)
const saltRounds = 10;

// POST /auth/signup  - Creates a new user in the database
router.post("/signup", async (req, res, next) => {
  const { email, password, name } = req.body;
  try {
    // Check if email or password or name are provided as empty strings
    if (email === "" || password === "" || name === "") {
      res.status(400).json({ message: "Provide email, password and name" });
      return;
    }

    // This regular expression check that the email is of a valid format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ message: "Provide a valid email address." });
      return;
    }

    // This regular expression checks password for special characters and minimum length
    const passwordRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;
    if (!passwordRegex.test(password)) {
      res.status(400).json({
        message:
          "Password must have at least 6 characters and contain at least one number, one lowercase and one uppercase letter.",
      });
      return;
    }

    // Check the users collection if a user with the same email already exists
    let foundUser = await User.findOne({ email });
    if (foundUser) {
      res.status(400).json({ message: "User already exists." });
      return;
    }

    // If email is unique, proceed to hash the password
    const salt = bcrypt.genSaltSync(saltRounds);
    const hashedPassword = bcrypt.hashSync(password, salt);

    let allClothes = await Clothing.find();
    let sampleClothes = allClothes.map((clothing) => {
      if (clothing.sample) {
        return clothing._id;
      }
    });
    let createdUser = await User.create({
      email,
      password: hashedPassword,
      name,
      userClothing: sampleClothes,
    });
    if (createdUser) {
      const { email, name, _id } = createdUser;
      const user = { email, name, _id };

      // Send a json response containing the user object
      res.status(201).json({ user: user });
    }
  } catch (error) {
    next(error);
  }
});

// POST  /auth/login - Verifies email and password and returns a JWT
router.post("/login", (req, res, next) => {
  const { email, password } = req.body;

  // Check if email or password are provided as empty string
  if (email === "" || password === "") {
    res.status(400).json({ message: "Provide email and password." });
    return;
  }

  // Check the users collection if a user with the same email exists
  User.findOne({ email })
    .then((foundUser) => {
      if (!foundUser) {
        // If the user is not found, send an error response
        res.status(401).json({ message: "User not found." });
        return;
      }

      // Compare the provided password with the one saved in the database
      const passwordCorrect = bcrypt.compareSync(password, foundUser.password);

      if (passwordCorrect) {
        // Deconstruct the user object to omit the password
        const { _id, email, name, laundry, packing } = foundUser;

        // Create an object that will be set as the token payload
        const payload = { _id, email, name, laundry, packing };

        // Create a JSON Web Token and sign it
        const authToken = jwt.sign(payload, process.env.TOKEN_SECRET, {
          algorithm: "HS256",
          expiresIn: "6h",
        });

        // Send the token as the response
        res.status(200).json({ authToken: authToken });
      } else {
        res.status(401).json({ message: "Unable to authenticate the user" });
      }
    })
    .catch((err) => next(err)); // In this case, we send error handling to the error handling middleware.
});

// GET  /auth/verify  -  Used to verify JWT stored on the client
router.get("/verify", isAuthenticated, (req, res, next) => {
  // If JWT token is valid the payload gets decoded by the
  // isAuthenticated middleware and is made available on `req.payload`
  console.log(`req.payload`, req.payload);

  // Send back the token payload object containing the user data
  res.status(200).json(req.payload);
});

router.get("/updateToken", isAuthenticated, async (req, res, next) => {
  const id = req.payload._id;

  const user = await User.findById(id).populate(
    "note userClothing laundry packing calendarClothing"
  );

  const {
    _id, email, name, laundry, packing 
  } = user;

  // Create an object that will be set as the token payload
  const payload = { _id, email, name, laundry, packing };

  const authToken = jwt.sign(payload, process.env.TOKEN_SECRET, {
    algorithm: "HS256",
    expiresIn: "6h",
  });

  res.status(200).json({ authToken: authToken });
});

module.exports = router;

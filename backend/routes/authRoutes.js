const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

router.post("/signup", async (req, res) => {
    try {
      const { name, email, password } = req.body;
  
      if (!name || !email || !password) {
        return res.status(400).json({
          message: "Name, email and password are required"
        });
      }
  
      const existingUser = await User.findOne({ email });
  
      if (existingUser) {
        return res.status(400).json({
          message: "Email already exists"
        });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
      });
  
      res.status(201).json({
        message: "User registered successfully"
      });
  
    } catch (error) {
      console.log(error);
      res.status(500).json({
        message: "Server error",
        error: error.message
      });
    }
  });

module.exports = router;
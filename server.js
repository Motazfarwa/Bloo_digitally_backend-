// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const Candidate = require("./models/condidate");

const app = express();

// --------------------------
// Setup Nodemailer with Gmail
// --------------------------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // farwamotez@gmail.com
    pass: process.env.EMAIL_PASS  // xnyc gvbu jmqi sxgy
  }
});

// Verify email configuration on startup
transporter.verify(function(error, success) {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// --------------------------
// CORS setup
// --------------------------
const allowedOrigins = [
  "https://bloodigitally.com",
  "http://localhost:3000", // For local development
  "http://localhost:5173"  // For Vite development
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.includes(origin)) {
      return callback(new Error(`CORS policy does not allow ${origin}`), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

app.use(express.json());

// --------------------------
// Multer setup for uploads
// --------------------------
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

// Optional: restrict file types and size
const upload = multer({ 
  storage,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("File type not allowed"), false);
    }
    cb(null, true);
  }
});

// --------------------------
// MongoDB connection
// --------------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// --------------------------
// POST /send-email
// --------------------------
app.post("/send-email", upload.array("files"), async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      linkedin,
      message,
      poste,
      dateNaissance,
      frenchLevel,
      englishLevel,
      interestedCountries,
      acceptTerms,
      service, 
    } = req.body;

    // Map uploaded files
    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      path: file.path,
      contentType: file.mimetype
    }));

    // Save candidate to MongoDB
    const candidate = new Candidate({
      fullName,
      email,
      phone,
      linkedin,
      message,
      poste,
      dateNaissance: dateNaissance ? new Date(dateNaissance) : undefined,
      languages: { french: frenchLevel, english: englishLevel },
      interestedCountries: interestedCountries
        ? interestedCountries.split(",").map(c => c.trim())
        : [],
      acceptTerms: acceptTerms === "true" || acceptTerms === true,
      service, 
      files: uploadedFiles,
      submittedAt: new Date()
    });

    await candidate.save();

    // Prepare attachments for Nodemailer
    const attachments = uploadedFiles.map(file => ({
      filename: file.filename,
      path: file.path,
      contentType: file.contentType
    }));

    // Send email via Nodemailer
    const mailOptions = {
      from: `"Blood Career" <${process.env.EMAIL_USER}>`, // farwamotez@gmail.com
      to: "bloocareer680@gmail.com", // Recipient email
      subject: `New Candidate Submission: ${fullName}`,
      text: `
Service: ${service}     
Full Name: ${fullName}
Email: ${email}
Phone: ${phone}
LinkedIn: ${linkedin}
Desired Position: ${poste}
Date of Birth: ${dateNaissance || "N/A"}
French Level: ${frenchLevel || "N/A"}
English Level: ${englishLevel || "N/A"}
Interested Countries: ${interestedCountries || "N/A"}
Accept Terms: ${acceptTerms}
Message: ${message}
      `,
      html: `
        <h2>New Candidate Submission</h2>
        <p><strong>Service:</strong> ${service}</p>
        <p><strong>Full Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>LinkedIn:</strong> ${linkedin || "N/A"}</p>
        <p><strong>Desired Position:</strong> ${poste}</p>
        <p><strong>Date of Birth:</strong> ${dateNaissance || "N/A"}</p>
        <p><strong>French Level:</strong> ${frenchLevel || "N/A"}</p>
        <p><strong>English Level:</strong> ${englishLevel || "N/A"}</p>
        <p><strong>Interested Countries:</strong> ${interestedCountries || "N/A"}</p>
        <p><strong>Accept Terms:</strong> ${acceptTerms}</p>
        <p><strong>Message:</strong><br>${message}</p>
      `,
      attachments,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      message: "Candidate submitted and email sent successfully!", 
      candidate 
    });
  } catch (error) {
    console.error('Error in /send-email:', error);
    res.status(500).json({ 
      message: "Failed to submit candidate.", 
      error: error.message 
    });
  }
});

// --------------------------
// GET /candidates
// --------------------------
app.get("/candidates", async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ submittedAt: -1 });
    res.status(200).json(candidates);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ 
      message: "Failed to fetch candidates.", 
      error: error.message 
    });
  }
});

// --------------------------
// Test email endpoint
// --------------------------
app.get("/test-email", async (req, res) => {
  try {
    const mailOptions = {
      from: `"Blood Career Test" <${process.env.EMAIL_USER}>`,
      to: "bloocareer680@gmail.com",
      subject: "Test Email from Render Backend",
      text: "This is a test email. If you receive this, Nodemailer is working correctly!",
      html: "<h1>Test Email 🚀</h1><p>If you receive this, Nodemailer is working correctly!</p>"
    };

    const info = await transporter.sendMail(mailOptions);
    
    res.status(200).json({ 
      success: true, 
      message: "Test email sent successfully!", 
      messageId: info.messageId 
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// --------------------------
// Serve uploaded files (optional)
// --------------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --------------------------
// Health check endpoint
// --------------------------
app.get("/", (req, res) => {
  res.json({ 
    status: "Server is running",
    timestamp: new Date().toISOString()
  });
});

// --------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

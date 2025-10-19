const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const Candidate = require("./models/condidate");
const nodemailer = require('nodemailer');

const app = express();
app.use(
  cors({
    origin: "https://bloo-digitaly-frontend.onrender.com",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

// Multer setup for multiple files (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Connect to MongoDB
mongoose
  .connect("mongodb+srv://bloo:bloo@cluster0.8pd4qvi.mongodb.net/")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// POST endpoint to handle multiple files
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
    } = req.body;

    // Map files to schema format
    const uploadedFiles = req.files.map((file) => ({
      data: file.buffer,
      contentType: file.mimetype,
      filename: file.originalname,
    }));

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
        ? interestedCountries.split(",").map((c) => c.trim())
        : [],
      acceptTerms: acceptTerms === "true" || acceptTerms === true,
      files: uploadedFiles,
    });

    await candidate.save();

    // --------------------------
    // Send email using Nodemailer
    // --------------------------
    // Create transporter (use your SMTP server or Gmail)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "bloocareer680@gmail.com",       // replace with your email
        pass: "tayn gdqp cslz ureo",          // Gmail app password
      },
    });

    // Prepare attachments
    const attachments = req.files.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
    }));

    // Email options
    const mailOptions = {
      from: `"Bloo Digitally" <YOUR_EMAIL@gmail.com>`,
      to: "farwamotez@gmail.com",  // default recipient
      subject: `New Candidate Submission: ${fullName}`,
      text: `
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
      attachments,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Candidate submitted and email sent successfully!", candidate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to submit candidate.", error });
  }
});

// GET all candidates (with file info)
app.get("/candidates", async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ submittedAt: -1 });
    res.status(200).json(candidates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch candidates.", error });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const brevo = require("@getbrevo/brevo");
const Candidate = require("./models/condidate");

const app = express();

// --------------------------
// Setup Brevo (Sendinblue)
// --------------------------
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

// Test Brevo on startup
(async () => {
  try {
    const testEmail = new brevo.SendSmtpEmail();
    testEmail.subject = "🚀 Server Started Successfully";
    testEmail.htmlContent = "<h1>✅ Brevo is working!</h1><p>Your backend is ready to receive applications.</p>";
    testEmail.sender = { name: "Blood Career", email: "farwamotez@gmail.com" };
    testEmail.to = [{ email: "bloocareer@gmail.com" }];
    
    await apiInstance.sendTransacEmail(testEmail);
    console.log('✅ Brevo email service is ready');
  } catch (error) {
    console.error('❌ Brevo error:', error.message);
  }
})();

// --------------------------
// CORS setup
// --------------------------

app.options("*", cors());
const allowedOrigins = [
  "https://bloodigitally.com",
  "http://localhost:3000",
  "http://localhost:5173"
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.includes(origin)) {
      return callback(new Error(`CORS not allowed: ${origin}`), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------
// Multer for file uploads
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

const upload = multer({ 
  storage,
  limits: { fileSize: 60 * 1024 * 1024 },
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
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// --------------------------
// POST /send-email
// --------------------------
app.post("/send-email", upload.array("files"), async (req, res) => {
  try {
    const {
      fullName, email, phone, linkedin, message,
      poste, dateNaissance, frenchLevel, englishLevel,
      interestedCountries, acceptTerms, service
    } = req.body;

    // Save uploaded files info
    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      path: file.path,
      contentType: file.mimetype
    }));

    // Save to MongoDB
    const candidate = new Candidate({
      fullName, email, phone, linkedin, message, poste,
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

    // Prepare attachments for Brevo
    const attachments = uploadedFiles.map(file => ({
      content: fs.readFileSync(file.path).toString("base64"),
      name: file.filename
    }));

    // Send email via Brevo
    const sendEmail = new brevo.SendSmtpEmail();
    
    sendEmail.subject = `📋 New Application: ${fullName} - ${service}`;
    sendEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #00bcd4 0%, #0097a7 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">New Candidate Application</h1>
          <p style="color: #e0f7fa; margin: 10px 0 0 0; font-size: 16px;">${service}</p>
        </div>
        
        <!-- Body -->
        <div style="background: #f5f5f5; padding: 30px;">
          
          <!-- Personal Info -->
          <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #00bcd4; margin-top: 0; border-bottom: 2px solid #00bcd4; padding-bottom: 10px;">👤 Personal Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; width: 40%;"><strong>Full Name:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${fullName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><a href="mailto:${email}" style="color: #00bcd4;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${phone}</td>
              </tr>
              ${linkedin ? `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>LinkedIn:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><a href="${linkedin}" style="color: #00bcd4;">View Profile</a></td>
              </tr>
              ` : ''}
              ${dateNaissance ? `
              <tr>
                <td style="padding: 10px 0;"><strong>Date of Birth:</strong></td>
                <td style="padding: 10px 0;">${dateNaissance}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <!-- Job/Position Info -->
          ${poste ? `
          <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #00bcd4; margin-top: 0; border-bottom: 2px solid #00bcd4; padding-bottom: 10px;">💼 Position</h2>
            <p style="margin: 0; font-size: 16px;"><strong>Desired Position:</strong> ${poste}</p>
          </div>
          ` : ''}

          <!-- Language Skills -->
          ${frenchLevel || englishLevel ? `
          <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #00bcd4; margin-top: 0; border-bottom: 2px solid #00bcd4; padding-bottom: 10px;">🌐 Language Skills</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${frenchLevel ? `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; width: 40%;"><strong>French:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><span style="background: #e0f7fa; color: #00bcd4; padding: 5px 15px; border-radius: 20px; font-weight: bold;">${frenchLevel}</span></td>
              </tr>
              ` : ''}
              ${englishLevel ? `
              <tr>
                <td style="padding: 10px 0;"><strong>English:</strong></td>
                <td style="padding: 10px 0;"><span style="background: #e0f7fa; color: #00bcd4; padding: 5px 15px; border-radius: 20px; font-weight: bold;">${englishLevel}</span></td>
              </tr>
              ` : ''}
            </table>
          </div>
          ` : ''}

          <!-- Preferences -->
          ${interestedCountries ? `
          <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #00bcd4; margin-top: 0; border-bottom: 2px solid #00bcd4; padding-bottom: 10px;">🌍 Preferences</h2>
            <p style="margin: 0;"><strong>Interested Region:</strong> ${interestedCountries}</p>
          </div>
          ` : ''}

          <!-- Message -->
          <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #00bcd4; margin-top: 0; border-bottom: 2px solid #00bcd4; padding-bottom: 10px;">💬 Message</h2>
            <p style="line-height: 1.6; color: #555; margin: 0;">${message}</p>
          </div>

          <!-- Footer Info -->
          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="margin: 0; color: #666;"><strong>Terms Accepted:</strong> ${acceptTerms ? '✅ Yes' : '❌ No'}</p>
            <p style="margin: 10px 0 0 0; color: #999; font-size: 13px;">📅 Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' })}</p>
            ${uploadedFiles.length > 0 ? `<p style="margin: 10px 0 0 0; color: #666;">📎 ${uploadedFiles.length} file(s) attached</p>` : ''}
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #263238; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="color: #b0bec5; margin: 0; font-size: 13px;">Blood Career Application System</p>
          <p style="color: #78909c; margin: 5px 0 0 0; font-size: 12px;">Powered by Brevo</p>
        </div>
      </div>
    `;
    
    sendEmail.sender = { 
      name: "Blood Career", 
      email: "farwamotez@gmail.com" 
    };
    
    sendEmail.to = [
      { email: "bloocareer@gmail.com", name: "Blood Career Team" }
    ];
    
    if (attachments.length > 0) {
      sendEmail.attachment = attachments;
    }

    await apiInstance.sendTransacEmail(sendEmail);

    res.status(200).json({ 
      message: "Application submitted successfully! We'll contact you soon.", 
      candidate 
    });

  } catch (error) {
    console.error('Error in /send-email:', error);
    res.status(500).json({ 
      message: "Failed to submit application. Please try again.", 
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
// GET /test-email
// --------------------------
app.get("/test-email", async (req, res) => {
  try {
    const testEmail = new brevo.SendSmtpEmail();
    
    testEmail.subject = "✅ Test Email from Render";
    testEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; text-align: center; background: #f5f5f5;">
        <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h1 style="color: #00bcd4; margin: 0 0 20px 0;">🚀 Email Test Successful!</h1>
          <p style="font-size: 18px; color: #555; margin: 0 0 30px 0;">
            If you're reading this, Brevo is working perfectly on your Render backend!
          </p>
          <div style="background: #e0f7fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0; color: #00695c;">✅ Brevo configured</p>
            <p style="margin: 5px 0; color: #00695c;">✅ Render deployment working</p>
            <p style="margin: 5px 0; color: #00695c;">✅ Ready to receive applications!</p>
          </div>
          <p style="color: #999; font-size: 14px; margin: 20px 0 0 0;">
            Test performed at: ${new Date().toLocaleString()}
          </p>
        </div>
      </div>
    `;
    
    testEmail.sender = { 
      name: "Blood Career Test", 
      email: "farwamotez@gmail.com" 
    };
    
    testEmail.to = [
      { email: "bloocareer@gmail.com" }
    ];

    await apiInstance.sendTransacEmail(testEmail);
    
    res.status(200).json({ 
      success: true, 
      message: "Test email sent! Check bloocareer@gmail.com inbox."
    });

  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// --------------------------
// Serve uploads
// --------------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --------------------------
// Health check
// --------------------------
app.get("/", (req, res) => {
  res.json({ 
    status: "🟢 Server running",
    service: "Blood Career Backend",
    emailProvider: "Brevo",
    timestamp: new Date().toISOString()
  });
});

// --------------------------
// Start server
// --------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📧 Email service: Brevo (Sendinblue)`);
  console.log(`🌍 Ready to accept applications!\n`);
});

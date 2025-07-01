const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(cors({
    origin: '*', // Allow all origins for development; restrict in production
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB Connection
let db;
const MONGODB_URI = process.env.MONGODB_URI;
console.log('Connecting to MongoDB:', MONGODB_URI);
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    })
    
.then(() => {
    console.log('Connected to MongoDB with Mongoose');
}).catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1); // Exit if connection fails
});

// Mongoose connection
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB with Mongoose'))
    .catch((error) => console.error('MongoDB connection error:', error));

// Native MongoDB connection (if needed for direct queries)
async function connectToDatabase() {
    try {
        const client = await MongoClient.connect(MONGODB_URI);
        db = client.db('test'); // or your actual database name
        console.log('Connected to MongoDB Atlas with native driver');
    } catch (error) {
        console.error('MongoDB Atlas connection error:', error);
        process.exit(1);
    }
}

connectToDatabase();

// Contact Schema
const contactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    ipAddress: String,
    userAgent: String
});

// Contact Model
const Contact = mongoose.model('Contact', contactSchema);

// Education Schema (if you're using Mongoose for education too)
const educationSchema = new mongoose.Schema({
    degree: String,
    institution: String,
    year: String,
    description: String,
    // Add other fields as needed
});

const Education = mongoose.model('Education', educationSchema);

// Email transporter configuration
console.log('Nodemailer config:', {
    secure: true,
    host: "smtp.gmail.com",
    port: 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Hide password in logs
    }
});

const transporter = nodemailer.createTransport({
    secure: true,
    host: "smtp.gmail.com",
    port: 465,
    auth: {
        user: process.env.EMAIL_USER, // Better to use env variable
        pass: process.env.EMAIL_PASS,  // Better to use env variable
    }
});

// Function to send email
async function sendMail(to, name, email, subject, message) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER || 'kasturibelan10@gmail.com',
            to: to,
            subject: subject,
            text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
            html: `
                <h3>New Contact Form Submission</h3>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Message:</strong> ${message}</p>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
}

// Routes
// POST - Save contact form data and send email
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Basic validation
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Email validation (basic)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        // Create new contact
        const newContact = new Contact({
            name,
            email,
            subject,
            message,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        console.log('New contact data:', newContact);              
        // Save to database
        const savedContact = await newContact.save();

        // Send email notification
        const emailResult = await sendMail(
            'kasturibelan10@gmail.com', // Your email where you want to receive notifications
            name,
            email,
            subject,
            message
        );

        if (!emailResult.success) {
            console.error('Failed to send email notification:', emailResult.error);
            // You might want to continue even if email fails
        }

        res.status(201).json({
            success: true,
            message: 'Message sent successfully!',
            data: {
                id: savedContact._id,
                name: savedContact.name,
                email: savedContact.email,
                subject: savedContact.subject,
                createdAt: savedContact.createdAt
            },
            emailSent: emailResult.success
        });

    } catch (error) {
        console.error('Error saving contact:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.'
        });
    }
});

// GET - Retrieve all contacts (for admin use)
app.get('/api/contacts', async (req, res) => {
    try {
        const contacts = await Contact.find()
            .sort({ createdAt: -1 })
            .select('-__v');

        res.json({
            success: true,
            count: contacts.length,
            data: contacts
        });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching contacts'
        });
    }
});

// GET - Retrieve education data (using native MongoDB driver)
app.get('/api/education', async (req, res) => {
    console.log('Fetching education data...');
     if (!db) {
        console.error('Database not connected');
        return res.status(500).json({ error: 'Database not connected' });
    }
    try {
        console.log('Fetching education from database...');
        
        // First, let's check what collections exist
        const collections = await db.listCollections().toArray();
        console.log('Available collections:', collections.map(col => col.name));
        
        // Try different possible collection names
        let education = [];
        const possibleNames = ['educations', 'education', 'Education'];
        
        for (const collectionName of possibleNames) {
            console.log(`Trying collection: ${collectionName}`);
            const result = await db.collection(collectionName).find({}).toArray();
            if (result && result.length > 0) {
                education = result;
                console.log(`Found ${result.length} education records in ${collectionName}`);
                break;
            }
        }
        
        if (!education || education.length === 0) {
            console.log('No education data found in any collection');
            
            // Let's also check the actual database name
            const admin = db.admin();
            const dbInfo = await admin.listDatabases();
            console.log('Available databases:', dbInfo.databases.map(db => db.name));
            
            return res.status(404).json({ 
                error: 'No education data found',
                availableCollections: collections.map(col => col.name),
                availableDatabases: dbInfo.databases.map(db => db.name)
            });
        }
        
        res.json({
            success: true,
            data: education
        });
    } catch (error) {
        console.error('Error fetching education data:', error);
        res.status(500).json({ error: 'Failed to fetch education data', details: error.message });
    }
});

// GET - Get single contact by ID
app.get('/api/contact/:id', async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        res.json({
            success: true,
            data: contact
        });

    } catch (error) {
        console.error('Error fetching contact:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching contact'
        });
    }
});

// DELETE - Delete contact (for admin use)
app.delete('/api/contact/:id', async (req, res) => {
    try {
        const contact = await Contact.findByIdAndDelete(req.params.id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        res.json({
            success: true,
            message: 'Contact deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting contact'
        });
    }
});

// Health check route
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});
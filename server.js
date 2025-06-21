import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// import scrapeRoute from "./scrapeRoute.js";
import { collectPosts } from "./linkedinScraper.js";

dotenv.config();
const port = process.env.PORT || 3000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
    try {
        res.status(200).json({ success: true, message: "Backend is LIVE" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

app.get("/scrapePosts", async (req, res) => {
    try {
        const results = collectPosts();
        res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error("LinkedIn automation error:", error);
        res.status(500).json({ success: false, message: "Login failed" });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`BACKEND listening on port ${port}`);
});

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from dist/
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback — serve index.html for unknown routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`n8n Experts Directory running on port ${PORT}`);
});

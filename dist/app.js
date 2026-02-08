import express from 'express';
const app = express();
const port = process.env.PORT || 5000;
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Routes
app.get('/', (req, res) => {
    res.status(200).send('Hello World!');
});
// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
export default app;
//# sourceMappingURL=app.js.map
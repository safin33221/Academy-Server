import express, { Express, Request, Response } from 'express';

const app: Express = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req: Request, res: Response) => {
    res.status(200).send('Hello World!');
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

export default app;


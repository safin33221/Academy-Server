import express, { Router } from 'express';
import { AuthRoutes } from '../module/auth/auth.route.js';



const router: Router = express.Router()


const moduleRoutes = [
    {
        path: '/auth',
        route: AuthRoutes
    },

]

moduleRoutes.map(route => router.use(route.path, route.route))

export default router
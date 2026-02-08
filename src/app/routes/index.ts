import express, { Router } from 'express';
import { AuthRoutes } from '../module/auth/auth.route.js';
import { OtpRoute } from '../module/otp/otp.route.js';



const router: Router = express.Router()


const moduleRoutes = [
    {
        path: '/auth',
        route: AuthRoutes
    },
    {
        path: '/otp',
        route: OtpRoute
    },

]

moduleRoutes.map(route => router.use(route.path, route.route))

export default router
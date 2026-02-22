import express, { Router } from 'express';
import { AuthRoutes } from '../module/auth/auth.route.js';
import { OtpRoute } from '../module/otp/otp.route.js';
import { UserRoutes } from '../module/user/user.route.js';
import { CourseRoute } from '../module/course/course.route.js';
import { BatchRoute } from '../module/batch/batch.route.js';
import { PaymentRoutes } from '../module/payment/payment.route.js';



const router: Router = express.Router()


const moduleRoutes = [
    {
        path: '/users',
        route: UserRoutes
    },
    {
        path: '/auth',
        route: AuthRoutes
    },
    {
        path: '/otp',
        route: OtpRoute
    },
    {
        path: '/course',
        route: CourseRoute
    },
    {
        path: '/batch',
        route: BatchRoute
    },
    {
        path: '/payment',
        route: PaymentRoutes
    },

]

moduleRoutes.map(route => router.use(route.path, route.route))

export default router
module.exports = (req, res, next) => {

    if (!req.isAuthenticated()) return next();

    const allowedRoutes = [
        "/complete-profile",
        "/logout",
    ];

    if (
        allowedRoutes.includes(req.path) ||
        req.path.startsWith("/auth")
    ) {
        return next();
    }

    if (!req.user.isProfileCompleted) {
        return res.redirect("/complete-profile");
    }

    next();

};
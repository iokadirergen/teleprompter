/**
 * Authentication Middleware
 * Protects admin routes by checking session authentication
 */

function requireAuth(req, res, next) {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }

    // If it's an API request, return 401
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Please login to access this resource' });
    }

    // Otherwise redirect to login page
    res.redirect('/admin-login.html');
}

module.exports = { requireAuth };

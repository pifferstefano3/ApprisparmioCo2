const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        // Prende il token dall'header Authorization: "Bearer TOKEN"
        const token = req.headers.authorization.split(' ')[1];
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decodedToken.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Richiesta non autenticata!' });
    }
};

const isAuthenticated = (req, res) => {
    if (req.hostCfg.protected) {
        req.hostCfg.authenticated = true;
        res.end(JSON.stringify({ authenticated: true }));
    } else {
        res.end(JSON.stringify({ authenticated: false }));
    }
}

module.exports = isAuthenticated;
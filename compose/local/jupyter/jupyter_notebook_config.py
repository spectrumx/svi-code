c.ServerApp.base_url = '/notebooks'
c.ServerApp.allow_origin = '*'
c.ServerApp.token = ''
c.ServerApp.ip = '0.0.0.0'
c.ServerApp.allow_root = True
c.ServerApp.root_dir = '/home/jovyan/work'

# Add these lines
c.ServerApp.trust_xheaders = True
c.ServerApp.default_url = '/tree'
c.ServerApp.disable_check_xsrf = True

# iframe support
c.ServerApp.tornado_settings = {
    'headers': {
        'Content-Security-Policy': "frame-ancestors 'self' http://localhost:3000"
    }
} 
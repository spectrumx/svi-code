c.NotebookApp.base_url = '/notebooks'
c.NotebookApp.allow_origin = '*'
c.NotebookApp.token = 'your_secure_token'  
c.NotebookApp.ip = '0.0.0.0'
c.NotebookApp.allow_root = True

#iframe support
c.NotebookApp.tornado_settings = {
    'headers': {
        'Content-Security-Policy': "frame-ancestors 'self' http://localhost:3000"
    }
} 
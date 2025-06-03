# SpectrumX Visualization Platform

Visualization platform for the SpectrumX project

[![Built with Cookiecutter Django](https://img.shields.io/badge/built%20with-Cookiecutter%20Django-ff69b4.svg?logo=cookiecutter)](https://github.com/cookiecutter/cookiecutter-django/)
[![Ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)

License: MIT

## Deployment

Docker Compose is the recommended deployment method for this project.

### Create secrets

If using the production deployment, create the secrets files:

```bash
rsync -aP .envs/.local/ .envs/.production/
```

Then set the secrets that will be used by the SVI services in these files.

### Creating the network

This will create an external network so that jupyter containers not in the compose files
can reattach to when the services are restarted.

```bash
./compose/create-network.sh
```

### Switching environments

To select the environment, set the `COMPOSE_FILE` environment variable to the desired
docker-compose file, i.e.:

```bash
# for development:
export COMPOSE_FILE=docker-compose.local.yml

# for production:
export COMPOSE_FILE=docker-compose.production.yml
```

Then proceed with other compose commands.

```bash
docker compose build
docker compose up
docker compose down
docker compose logs -f
```

## Basic Commands

### Setting Up Your Users

- To create a **normal user account**, just go to Sign Up and fill out the form. Once you submit it, you'll see a "Verify Your E-mail Address" page. Go to your console to see a simulated email verification message. Copy the link into your browser. Now the user's email should be verified and ready to go.

- To create a **superuser account**, use this command:

```bash
python manage.py createsuperuser
```

For convenience, you can keep your normal user logged in on Chrome and your superuser logged in on Firefox (or similar), so that you can see how the site behaves for both kinds of users.

### Type checks

Running type checks with mypy:

```bash
mypy spectrumx_visualization_platform
```

### Test coverage

To run the tests, check your test coverage, and generate an HTML coverage report:

```bash
coverage run -m pytest
coverage html
open htmlcov/index.html
```

#### Running tests with pytest

```bash
pytest
```

### Live reloading and Sass CSS compilation

Moved to [Live reloading and SASS compilation](https://cookiecutter-django.readthedocs.io/en/latest/developing-locally.html#sass-compilation-live-reloading).

### Celery

This app comes with Celery.

To run a celery worker:

```bash
cd spectrumx_visualization_platform
celery -A config.celery_app worker -l info
```

Please note: For Celery's import magic to work, it is important _where_ the celery commands are run. If you are in the same folder with _manage.py_, you should be right.

To run [periodic tasks](https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html), you'll need to start the celery beat scheduler service. You can start it as a standalone process:

```bash
cd spectrumx_visualization_platform
celery -A config.celery_app beat
```

or you can embed the beat service inside a worker with the `-B` option (not recommended for production use):

```bash
cd spectrumx_visualization_platform
celery -A config.celery_app worker -B -l info
```

## Auth0

See detailed [Auth0 documentation](https://auth0.com/docs).

### Modifications to Code Base

1. Modify the `requirements/base.txt` to include `socialaccount` in `django-allauth`

```ini
django-allauth[socialaccount]==65.0.2  # https://github.com/pennersr/django-allauth
fido2==1.1.3  # https://github.com/Yubico/python-fido2
```

2. Add Environment Variables to `.envs/.local/.django`

```bash
# Auth0
AUTH0_DOMAIN=https://[DOMAIN].us.auth0.com
```

3. Add Auth0 to `config/settings/base.py`

```py
# Auth0 Configuration
SOCIALACCOUNT_PROVIDERS = {
    "auth0": {
        "AUTH0_URL": env("AUTH0_DOMAIN"),
        "OAUTH_PKCE_ENABLED": True,
        "SCOPE": [
            "openid",
            "profile",
            "email",
        ],
    }
}

# Add 'allauth.socialaccount.providers.auth0' to INSTALLED_APPS
INSTALLED_APPS += ["allauth.socialaccount.providers.auth0"]
```

4. Add a `Social Application` in the Django Admin for Auth0

- Provider: `Auth0`
- Provider ID: `auth0`
- Name: `SpectrumX Auth0 Provider`
- Client ID: `[CLIENT_ID]`
- Secret: `[SECRET]`
- Key: `auth0`
- Sites: `[CONFIGURED SITE]` (localhost:8000, etc.)

5. Login through the social application by visiting the login page at `/accounts/auth0/login`

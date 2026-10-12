WIFI_SSID = ""
WIFI_PASSWORD = ""
REGION = "eu"
TIMEZONE = 0
GITHUB_USERNAME = ""
GITHUB_TOKEN = ""


def require(*names):
    for name in names:
        if name not in globals():
            raise ValueError("Missing simulator setting: " + name)

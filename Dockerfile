FROM python:3.12-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ /app/

EXPOSE 3012

CMD ["gunicorn", "-b", "0.0.0.0:3012", "--workers", "2", "--worker-class", "gthread", "--threads", "4", "--timeout", "660", "--keep-alive", "5", "server:app"]

# The KYC service, for the VPS.
#
# Two stages, because the wheels need a compiler and the running container should
# not have one: insightface builds from source, and numpy and opencv want a
# toolchain whenever pip falls back from a wheel. The final image takes the
# finished virtualenv and nothing else.
#
# The face and image models (about 290 MB) are baked in, in a layer before the
# code, so a code change does not fetch them again. That lets the image run where
# there is no host folder to mount, such as Render. On the VPS, docker-compose.yml
# still mounts the host's models/ over them. The OCR's own models are baked too.

FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      cmake \
      git \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt


FROM python:3.11-slim

# tesseract is the second MRZ reader (app/engines/ocr.py). libgl1 and libglib2.0-0
# are what OpenCV needs to import at all, libgomp1 is the OpenMP runtime ONNX Runtime and OpenCV load,
# and curl is the healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
      tesseract-ocr \
      tesseract-ocr-eng \
      libgl1 \
      libglib2.0-0 \
      libgomp1 \
      curl \
      unzip \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /srv

# The OCR's models (~30 MB), fetched now so the first person to submit a document
# is not waiting for a download.
RUN python -c "from rapidocr import RapidOCR; RapidOCR()"

# The face and image models, checked against their hashes.
COPY docker/fetch-models.sh /tmp/fetch-models.sh
RUN sh /tmp/fetch-models.sh /srv/models && rm /tmp/fetch-models.sh

COPY . .

# Not root. The service writes only to /srv/var, which is a mounted volume, and
# reads the models read-only. The container starts as root only so the
# entrypoint can give a freshly mounted disk to the kyc user (a Render disk
# arrives owned by root); it then drops to kyc before anything else runs.
RUN useradd --create-home --uid 10001 kyc \
    && mkdir -p /srv/var/evidence \
    && chown -R kyc:kyc /srv/var

# 8000 inside the container whatever the host publishes. The host port is in
# docker-compose.yml.
EXPOSE 8000

ENTRYPOINT ["/srv/docker/entrypoint.sh"]

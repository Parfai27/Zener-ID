#!/bin/sh
# Downloads the face and image models (about 290 MB) into the folder given, or
# backend/models. The same files and checksums as the deploy workflow
# (.github/workflows/build.yml). The image runs it at build time (Dockerfile):
#
#   sh docker/fetch-models.sh [folder]
#
# Only missing files are fetched; a file that does not match its checksum is
# fetched again.
set -e
cd "$(dirname "$0")/.."
TARGET="${1:-models}"
mkdir -p "$TARGET"
cd "$TARGET"

drop_if_wrong() {
  if [ -f "$2" ] && ! echo "$1  $2" | sha256sum -c - > /dev/null 2>&1; then
    echo "$2 does not match its checksum, fetching it again"
    rm -f "$2"
  fi
}
drop_if_wrong 5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91 ./det_10g.onnx
drop_if_wrong 4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43 ./w600k_r50.onnx
drop_if_wrong a42c7d740fbb345ba9a26d469b22f301d73089ce3c6da993877ed2b6965a8ba1 ./ai_image_detector.onnx

if [ ! -f ./face_detection_yunet_2023mar.onnx ]; then
  echo "downloading YuNet"
  curl -sL --fail -o ./face_detection_yunet_2023mar.onnx \
    https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
fi

if [ ! -f ./face_landmarker.task ]; then
  echo "downloading the MediaPipe face landmarker"
  curl -sL --fail -o ./face_landmarker.task \
    https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task
fi

if [ ! -f ./det_10g.onnx ] || [ ! -f ./w600k_r50.onnx ]; then
  echo "downloading the buffalo_l pack for SCRFD and ArcFace"
  curl -sL --fail -o /tmp/buffalo_l.zip \
    https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip
  unzip -j -o /tmp/buffalo_l.zip 'det_10g.onnx' 'w600k_r50.onnx' -d ./
  rm -f /tmp/buffalo_l.zip
fi

# The AI-generated image detector, pinned to the revision with the corrected export.
if [ ! -f ./ai_image_detector.onnx ]; then
  echo "downloading the AI-generated image detector"
  curl -sL --fail -o ./ai_image_detector.onnx \
    https://huggingface.co/buildborderless/CommunityForensics-DeepfakeDet-ViT/resolve/ac6ee457bea904a373065754107451793b56db00/onnx/model.onnx
fi

echo "5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91  ./det_10g.onnx" | sha256sum -c -
echo "4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43  ./w600k_r50.onnx" | sha256sum -c -
echo "a42c7d740fbb345ba9a26d469b22f301d73089ce3c6da993877ed2b6965a8ba1  ./ai_image_detector.onnx" | sha256sum -c -
echo "models ready in $(pwd)"

set -eu

manifest=$(mktemp)
trap 'rm -f "$manifest"' EXIT
kubectl kustomize deploy/k8s > "$manifest"
go run github.com/yannh/kubeconform/cmd/kubeconform@v0.7.0 -strict -summary -kubernetes-version 1.32.0 < "$manifest"

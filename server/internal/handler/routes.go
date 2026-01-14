package handler

import (
	"net/http"

	"github.com/anthropics/octobot/server/internal/routes"
)

// GetRoutes returns all registered API routes with their metadata.
// This endpoint powers the API UI's dynamic route listing.
func (h *Handler) GetRoutes(w http.ResponseWriter, r *http.Request) {
	h.JSON(w, http.StatusOK, routes.All())
}

import { Router } from "express";
import {
	dismissRecommendation, getDismissedRecommendationsHandler, getRecommendationPreferencesHandler,
	getRecommendations, undoDismissRecommendation, updateRecommendationPreferences,
	getRecommendationEngineHandler, updateRecommendationEngine,
} from "./recommendations.controller";
import authMiddleware from "../../middlewares/auth.middleware";
import asyncHandler from "../../utils/asyncHandler";
import pilotRouter from "./recommendations.pilot.routes";

const router = Router();
router.use("/pilot", pilotRouter);

/**
 * @swagger
 * /api/recommendations:
 *   get:
 *     summary: Get personalized recommendations for the user
 *     description: |
 *       Engine `f11b-v1`. Signals are local myCDrecords actions and explicit genre/artist preferences on MusicBrainz albums only (reviews >= 4 or favorites positive, <= 2 negative; Spotify-ID reviews are ignored). Candidates come from the persisted MusicBrainz catalog by exact tags (weight 1) or adjacent tags of a static taxonomy (weight 0.5) plus collaborative co-occurrence (>= 2 distinct people).
 *       score = 0.5 tags + 0.35 collaborative + 0.15 community quality, each normalized 0-1. Reviewed, favorite and dismissed albums are excluded. Max 2 albums per artist in the first 10; every 5th slot prefers an adjacent-tag exploration item.
 *       With fewer than 3 positive tagged review signals or explicit preferences (or no personalized candidate) the response is `popular` (albums rated >= 4 by at least 2 other people), never presented as personalized. The ranking (max 120) is cached per user for 10 minutes and invalidated by review/favorite/dismiss/preference changes, so offsets are stable inside that window.
 *       The account preference saved through PUT /api/recommendations/engine enables `artist-bpr-fictional-v1`, trained only on independently simulated preferences for 24 artist names, never real users or Spotify. Defaults to disabled; the legacy engine query is validated but ignored. It folds the actor's MusicBrainz-linked ratings/favorites and explicit artist preferences into a private, ephemeral vector; no tags or other people's actions enter ML. Explicit ratings override favorites; neutral=0, negative=(rating-3)/2. Exact names only; candidates are up to 20 persisted core MusicBrainz albums per supported artist, ranked by mean artist affinity, score >= 0.35, at most 2 albums per artist overall. Reviewed/favorite/dismissed albums remain excluded. Synthetic quality does not prove real-world quality.
 *       ML rankings are not cached or persisted and are recomputed from current signals per request. `ml.status=active` means the returned ranking uses ML (evidence counts net-positive supported artists; required=1). `cold_start` or `no_candidates` explicitly identifies a fallback to f11b-v1; the response version/reasons describe the engine actually used. Corrupt model, conformance or storage failures return 503, not a disguised fallback.
 *     tags:
 *       - Recommendations
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: engine
 *         deprecated: true
 *         description: Ignored; the saved account preference always determines the engine.
 *         schema:
 *           type: string
 *           enum: [heuristic, ml]
 *           default: heuristic
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 12
 *           minimum: 1
 *           maximum: 48
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *           maximum: 120
 *     responses:
 *       200:
 *         description: Ranked recommendations page (Cache-Control private, no-store).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [tipo, mlEnabled, version, evidence, perfil, total, offset, limit, nextOffset, data]
 *               properties:
 *                 mlEnabled:
 *                   type: boolean
 *                   description: Saved account preference, even when ML falls back to the original engine.
 *                 tipo:
 *                   type: string
 *                   enum: [personalizada, popular, vazio]
 *                 version:
 *                   type: string
 *                   example: "f11b-v1"
 *                 ml:
 *                   type: object
 *                   description: Present only when the account has enabled ML.
 *                   properties:
 *                     status: { type: string, enum: [active, cold_start, no_candidates] }
 *                     modelVersion: { type: string, enum: [artist-bpr-fictional-v1] }
 *                     trainedOn: { type: string, enum: [fictional-profiles] }
 *                     supportedArtists: { type: array, items: { type: string } }
 *                 evidence:
 *                   type: object
 *                   properties:
 *                     signals:
 *                       type: integer
 *                       description: Positive review signals plus distinct explicit genre/artist preferences.
 *                     required:
 *                       type: integer
 *                       example: 3
 *                 perfil:
 *                   type: object
 *                   properties:
 *                     reviews:
 *                       type: integer
 *                     favorites:
 *                       type: integer
 *                 total:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 nextOffset:
 *                   type: integer
 *                   nullable: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       album_id:
 *                         type: string
 *                         format: uuid
 *                       album_title:
 *                         type: string
 *                       album_artist:
 *                         type: string
 *                       album_image:
 *                         type: string
 *                         description: Cover Art Archive URL; may be unavailable.
 *                       release_date:
 *                         type: string
 *                         nullable: true
 *                       source:
 *                         type: string
 *                         enum: [musicbrainz]
 *                       reasons:
 *                         type: array
 *                         description: Only signals actually used for this item.
 *                         items:
 *                           oneOf:
 *                             - type: object
 *                               properties:
 *                                 type: { type: string, enum: [ml] }
 *                             - type: object
 *                               properties:
 *                                 type: { type: string, enum: [tags] }
 *                                 tags: { type: array, items: { type: string } }
 *                             - type: object
 *                               properties:
 *                                 type: { type: string, enum: [collaborative] }
 *                                 people: { type: integer }
 *                             - type: object
 *                               properties:
 *                                 type: { type: string, enum: [exploration] }
 *                                 tag: { type: string }
 *                                 from: { type: string }
 *                             - type: object
 *                               properties:
 *                                 type: { type: string, enum: [community] }
 *                                 people: { type: integer }
 *       400:
 *         description: Invalid limit or offset.
 *       401:
 *         description: Unauthorized. The authentication token is missing, invalid, or expired.
 *       500:
 *         description: Internal server error.
 *       503:
 *         description: ML_UNAVAILABLE. Model validation, parity or ML data access failed. Retry or select the original engine.
 */
router.get("/", authMiddleware, asyncHandler(getRecommendations));

/**
 * @swagger
 * /api/recommendations/engine:
 *   get:
 *     summary: Get the authenticated account's saved experimental ML choice
 *     description: Independent of model availability. Defaults to false; private, no-store. Not training consent.
 *     tags: [Recommendations]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Saved inference choice.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [enabled]
 *               properties:
 *                 enabled: { type: boolean }
 *       401:
 *         description: Unauthorized.
 *       500:
 *         description: Storage unavailable.
 *   put:
 *     summary: Save the authenticated account's experimental ML choice
 *     description: Persists inference only; does not authorize collection or training. Preserves artist/genre preferences. Idempotent; actor comes only from authentication. Returns the saved enabled boolean with private, no-store.
 *     tags: [Recommendations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [enabled]
 *             properties:
 *               enabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Saved inference choice, object with enabled boolean.
 *       400:
 *         description: Invalid body.
 *       401:
 *         description: Unauthorized.
 *       500:
 *         description: Choice could not be saved.
 */
router.get("/engine", authMiddleware, asyncHandler(getRecommendationEngineHandler));
router.put("/engine", authMiddleware, asyncHandler(updateRecommendationEngine));

/**
 * @swagger
 * /api/recommendations/preferences:
 *   get:
 *     summary: Get the current user's recommendation preferences
 *     tags: [Recommendations]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Explicit MusicBrainz genre tags and artist names.
 *       401:
 *         description: Unauthorized.
 *   put:
 *     summary: Replace the current user's recommendation preferences
 *     description: Saves up to 20 genres and 20 artist names and invalidates the user's recommendation cache.
 *     tags: [Recommendations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [genres, artists]
 *             properties:
 *               genres:
 *                 type: array
 *                 maxItems: 20
 *                 items: { type: string, maxLength: 80 }
 *               artists:
 *                 type: array
 *                 maxItems: 20
 *                 items: { type: string, maxLength: 120 }
 *     responses:
 *       200:
 *         description: Preferences saved.
 *       400:
 *         description: Invalid or duplicate preferences.
 *       401:
 *         description: Unauthorized.
 */
router.get("/preferences", authMiddleware, asyncHandler(getRecommendationPreferencesHandler));
router.put("/preferences", authMiddleware, asyncHandler(updateRecommendationPreferences));

/**
 * @swagger
 * /api/recommendations/dismissed:
 *   get:
 *     summary: List albums dismissed by the current user
 *     tags: [Recommendations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 12, minimum: 1, maximum: 48 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0, minimum: 0, maximum: 120 }
 *     responses:
 *       200:
 *         description: Private paginated list of dismissed MusicBrainz albums.
 *       400:
 *         description: Invalid pagination.
 *       401:
 *         description: Unauthorized.
 */
router.get("/dismissed", authMiddleware, asyncHandler(getDismissedRecommendationsHandler));

/**
 * @swagger
 * /api/recommendations/dismissed/{albumId}:
 *   put:
 *     summary: Mark a recommended album as "not interested"
 *     description: Idempotent. The album is excluded from future recommendations for this user and the cached ranking is invalidated.
 *     tags:
 *       - Recommendations
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: MusicBrainz release-group ID.
 *     responses:
 *       204:
 *         description: Dismissed (or already dismissed).
 *       400:
 *         description: albumId is not a MusicBrainz ID.
 *       401:
 *         description: Unauthorized.
 *   delete:
 *     summary: Undo a dismissal
 *     description: Idempotent; removing a dismissal that does not exist also returns 204.
 *     tags:
 *       - Recommendations
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Dismissal removed.
 *       400:
 *         description: albumId is not a MusicBrainz ID.
 *       401:
 *         description: Unauthorized.
 */
router.put("/dismissed/:albumId", authMiddleware, asyncHandler(dismissRecommendation));
router.delete("/dismissed/:albumId", authMiddleware, asyncHandler(undoDismissRecommendation));

export default router;
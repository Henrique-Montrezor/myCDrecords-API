import { raw, Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import authMiddleware, { optionalAuthMiddleware } from "../../middlewares/auth.middleware";
import { exploreListsController, saveListController } from "./lists.discovery";
import { uploadListImageController, deleteListImageController, readListImageController, moveListItemController } from "./lists.identity.controller";
import {
    createListController,
    myListsController,
    userListsController,
    getListController,
    updateListController,
    deleteListController,
    addListItemController,
    removeListItemController,
} from "./lists.controller";

const router = Router();
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

/**
 * @swagger
 * /api/lists/{listId}/images/{kind}:
 *   parameters:
 *     - in: path
 *       name: listId
 *       required: true
 *       schema: { type: integer, minimum: 1 }
 *     - in: path
 *       name: kind
 *       required: true
 *       schema: { type: string, enum: [thumbnail, banner] }
 *   get:
 *     summary: Read list-owned image bytes with current visibility authorization
 *     description: "Public lists accept anonymous reads; private lists require the owner. Never served by a static/public URL. JPEG bytes with no-store and nosniff, not a redirect or signed URL."
 *     tags: [Lists]
 *     security: [{}, { BearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Re-encoded JPEG
 *         content:
 *           image/jpeg:
 *             schema: { type: string, format: binary }
 *       400: { description: Invalid ID or kind }
 *       403: { description: Private list and caller is not the owner }
 *       404: { description: List or image not found }
 *   put:
 *     summary: Replace the list thumbnail or banner (owner only)
 *     description: "Raw JPEG, PNG or WebP; maximum 2 MiB. Signature and decoding validated, 64..8000 pixels per side, maximum 16 megapixels, static images only. Re-encoded without EXIF to JPEG 512x512 (thumbnail) or 1600x480 (banner), center-cropped. Stored as private MySQL bytes; only upload images you have rights to publish, never imported Spotify imagery."
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         image/jpeg:
 *           schema: { type: string, format: binary }
 *         image/png:
 *           schema: { type: string, format: binary }
 *         image/webp:
 *           schema: { type: string, format: binary }
 *     responses:
 *       204: { description: Image replaced and image_revision advanced atomically }
 *       400: { description: Invalid ID or kind }
 *       401: { description: Authentication required }
 *       403: { description: Caller does not own the list }
 *       404: { description: List not found }
 *       413: { description: File empty or exceeds 2 MiB }
 *       415: { description: Unsupported image signature or non-binary body }
 *       422: { description: Invalid dimensions, animation or corrupted image }
 *   delete:
 *     summary: Remove the list image (owner only)
 *     description: Idempotent for existing owned lists; image bytes and image_revision are updated in one transaction.
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       204: { description: Removed, including an already absent image }
 *       400: { description: Invalid ID or kind }
 *       401: { description: Authentication required }
 *       403: { description: Caller does not own the list }
 *       404: { description: List not found }
 * /api/lists/{listId}/order:
 *   put:
 *     summary: Atomically move one album to a global one-based position
 *     description: "Owner only. Free curatorial order, not a ranking. Send the latest order_revision as revision. Locks the parent list, normalizes legacy position ties with creation/ID order, rewrites positions and advances the revision in one transaction. Other adds/removals advance the same revision. A stale revision returns 409 without writing positions. No-op preserves revision. Response page points to the moved album, with 24 items per page; client never sends or downloads all items."
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [revision, itemId, toPosition]
 *             properties:
 *               revision: { type: integer, minimum: 0, maximum: 4294967294 }
 *               itemId: { type: integer, minimum: 1 }
 *               toPosition: { type: integer, minimum: 1, description: One-based global destination, no greater than the list item count }
 *     responses:
 *       200:
 *         description: Position persisted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [revision, page]
 *               properties:
 *                 revision: { type: integer }
 *                 page: { type: integer }
 *       400: { description: Invalid input or destination outside the list }
 *       401: { description: Authentication required }
 *       403: { description: Caller does not own the list }
 *       404: { description: List or album item not found }
 *       409: { description: Order changed; reload and reconcile rather than overwrite }
 */
router.get("/:listId/images/:kind", optionalAuthMiddleware, asyncHandler(readListImageController));
router.put("/:listId/images/:kind", authMiddleware, raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "2mb" }), asyncHandler(uploadListImageController));
router.delete("/:listId/images/:kind", authMiddleware, asyncHandler(deleteListImageController));
router.put("/:listId/order", authMiddleware, asyncHandler(moveListItemController));

/**
 * @swagger
 * tags:
 *   - name: Lists
 *     description: Custom album collections/lists
 */

/**
 * @swagger
 * /api/lists/explore:
 *   get:
 *     summary: Explore public curations or the authenticated user's own lists
 *     description: "Fixed 30-day window. Popular requires at least 3 distinct third-party savers; author saves never count. Ties use save count, creation date and ID descending. If the filtered ranking is empty, mode is recent. Recent sorts by creation date and ID descending. Friends means mutual follows; following means outgoing follows. Only mine includes private lists. All responses are no-store."
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *           enum: [popular, following, friends, mine, saved]
 *           default: popular
 *       - in: query
 *         name: q
 *         description: Literal substring of title or author username
 *         schema:
 *           type: string
 *           maxLength: 100
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [popular, recent]
 *           default: popular
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           default: 1
 *     responses:
 *       200:
 *         description: "Real page of at most 20 lists; an out-of-range page is empty without changing ranking mode."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [items, total, page, pageSize, totalPages, mode]
 *               properties:
 *                 mode: { type: string, enum: [popular, recent] }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer, enum: [20] }
 *                 totalPages: { type: integer }
 *                 items:
 *                   type: array
 *                   maxItems: 20
 *                   items:
 *                     type: object
 *                     required: [id, user_id, title, description, username, is_public, is_saved, item_count, save_count, created_at, updated_at, previews]
 *                     properties:
 *                       id: { type: integer }
 *                       user_id: { type: integer }
 *                       title: { type: string }
 *                       description: { type: string, nullable: true }
 *                       username: { type: string }
 *                       is_public: { type: boolean }
 *                       is_saved: { type: boolean }
 *                       item_count: { type: integer }
 *                       save_count: { type: integer, description: Distinct third-party saves in the last 30 days }
 *                       created_at: { type: string, format: date-time }
 *                       updated_at: { type: string, format: date-time }
 *                       order_revision: { type: integer }
 *                       image_revision: { type: integer }
 *                       has_thumbnail: { type: integer, enum: [0, 1], description: Image bytes require a separate authorized read }
 *                       has_banner: { type: integer, enum: [0, 1] }
 *                       previews:
 *                         type: array
 *                         maxItems: 4
 *                         items:
 *                           type: object
 *                           properties:
 *                             album_id: { type: string }
 *                             album_title: { type: string, nullable: true }
 *                             album_image: { type: string, nullable: true }
 *       400:
 *         description: Invalid or repeated query parameter, or unsupported query field
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Storage failure, never an empty success fallback
 * /api/lists/{listId}/saved:
 *   put:
 *     summary: Save a public list as a personal bookmark
 *     description: Idempotent. Does not refresh the original saved timestamp, copy items or follow the author.
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       204: { description: Saved, including repeated saves }
 *       400: { description: Invalid ID or saving your own public list }
 *       401: { description: Authentication required }
 *       403: { description: Private list }
 *       404: { description: List not found }
 *   delete:
 *     summary: Remove the authenticated user's saved marker
 *     description: Idempotent for existing lists, including private lists. A deleted or unknown list returns 404.
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       204: { description: Removed, including an already absent bookmark }
 *       400: { description: Invalid ID }
 *       401: { description: Authentication required }
 *       404: { description: List not found }
 */
router.get("/explore", authMiddleware, asyncHandler(exploreListsController));
router.put("/:listId/saved", authMiddleware, asyncHandler(saveListController(true)));
router.delete("/:listId/saved", authMiddleware, asyncHandler(saveListController(false)));

/**
 * @swagger
 * /api/lists:
 *   post:
 *     summary: Create a new list
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: List created
 *       401:
 *         description: Not authenticated
 */
router.post("/", authMiddleware, asyncHandler(createListController));

/**
 * @swagger
 * /api/lists/me:
 *   get:
 *     summary: Lists the authenticated user's lists
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User's lists
 */
router.get("/me", authMiddleware, asyncHandler(myListsController));

/**
 * @swagger
 * /api/lists/user/{userId}:
 *   get:
 *     summary: Lists a user's public lists
 *     tags: [Lists]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Public lists
 */
router.get("/user/:userId", optionalAuthMiddleware, asyncHandler(userListsController));

/**
 * @swagger
 * /api/lists/{listId}:
 *   get:
 *     summary: Details a list with a page of at most 24 items
 *     description: "Public lists accept anonymous reads; private lists require the owner. Includes username, is_saved, global item_count, page, pageSize (24), totalPages, order_revision, image_revision, has_thumbnail and has_banner (0/1). Image bytes are fetched separately with authorization. Items sort by position (null treated as zero), creation date and ID ascending. All responses are no-store."
 *     tags: [Lists]
 *     security: [{}, { BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, maximum: 10000, default: 1 }
 *     responses:
 *       200:
 *         description: List metadata and one page of items; empty items on out-of-range page does not mean an empty list
 *       400:
 *         description: Invalid or repeated page, unsupported query field or invalid ID
 *       403:
 *         description: Private list
 *       404:
 *         description: List not found
 *   put:
 *     summary: Updates a list
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: List updated
 *       404:
 *         description: List not found or access denied
 *   delete:
 *     summary: Removes a list
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: List removed
 *       404:
 *         description: List not found or access denied
 */
router.get("/:listId", optionalAuthMiddleware, asyncHandler(getListController));
router.put("/:listId", authMiddleware, asyncHandler(updateListController));
router.delete("/:listId", authMiddleware, asyncHandler(deleteListController));

/**
 * @swagger
 * /api/lists/{listId}/items:
 *   post:
 *     summary: Adds an album to the list
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [albumId]
 *             properties:
 *               albumId:
 *                 type: string
 *               albumTitle:
 *                 type: string
 *               albumImage:
 *                 type: string
 *               albumArtist:
 *                 type: string
 *               position:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Album added
 *       409:
 *         description: Album is already in the list
 */
router.post("/:listId/items", authMiddleware, asyncHandler(addListItemController));

/**
 * @swagger
 * /api/lists/{listId}/items/{albumId}:
 *   delete:
 *     summary: Removes an album from the list
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Album removed
 *       404:
 *         description: Album not found in the list
 */
router.delete("/:listId/items/:albumId", authMiddleware, asyncHandler(removeListItemController));

export default router;

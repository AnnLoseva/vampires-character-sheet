# VTM Media Studio Architecture

## Product Shape

The character sheet and table should feel like one creative workspace:

- **Canvas first:** the sheet/table remains the center; media tools appear as floating or docked surfaces.
- **Drag everywhere:** files, URLs, library items, layers, folders, and scene media all share the same drag vocabulary.
- **Cursor-aware UI:** context menus, popovers, and editors open near intent, then flip into the viewport.
- **Multiplayer by default:** every saved layer/media mutation writes to `table_images` and broadcasts through the room channel.

## Component Map

```text
app/table/page.tsx
  VampireTable
    PlaySurface
      SceneWorld
      SceneLayer
      SelectionHandles
      SmartContextMenu
      ImageEditorOverlay
    MediaStudioRail
      MediaTabs
      LayerTree
      MediaLibrary
      SceneLibrary
      MusicPanel
    MasterScenePanel
      SceneList
      SceneLayerGroups
      SceneMediaDropZone
```

The current implementation keeps this mostly inside `components/VampireTable.tsx`. When it grows again, split it along those names:

- `components/media-studio/ImageEditorOverlay.tsx`
- `components/media-studio/LayerTree.tsx`
- `components/media-studio/SmartContextMenu.tsx`
- `components/media-studio/useMediaStudioRealtime.ts`
- `components/media-studio/useSmartFloatingPosition.ts`

## Data Model

`table_images` is the authoritative multiplayer model for canvas and library items:

- identity: `id`, `room`, `scene_id`, `owner_role`, `owner_id`
- hierarchy: `parent_id`, `z_index`, `on_table`
- placement: `x`, `y`, `width`, `height`
- crop: `crop_x`, `crop_y`, `crop_width`, `crop_height`
- look: `opacity`, `blend_mode`, `rotation`, `flip_x`, `flip_y`, `brightness`, `contrast`, `saturation`
- media: `layer_type`, `name`, `image_data`

Run `supabase/media_studio_layers.sql` after the existing table migrations.

## Realtime Flow

1. User action updates local React state immediately.
2. The room channel broadcasts a compact event: `layer-update`, `layer`, or `layer-delete`.
3. Supabase persists the same patch.
4. Postgres realtime catches durable changes for late or reconnecting clients.

This gives fast multiplayer feedback while still recovering from dropped websocket events.

## Editor Flow

Click/double-click an image or choose **Редактировать изображение**:

1. `ImageEditorOverlay` creates an isolated draft state.
2. Crop handles mutate percentages visually, not through text input.
3. Rotate, flip, brightness, contrast, and saturation are undoable in editor history.
4. **Применить** patches the layer.
5. **Сохранить как новое** duplicates the layer with the same source media and new edit metadata.

## Migration From `old-sheet.html`

1. Keep `old-sheet.html` read-only while table media stabilizes.
2. Move portrait/touchstone upload points to React slots that accept:
   - local files,
   - library drag items,
   - URL drops,
   - right-click “add to media library”.
3. Store every image in Supabase Storage under `table-images/{room}/...`.
4. Save sheet slot references as media IDs first, public URLs second.
5. Replace inline image compression code in `public/main.js` with the shared upload path.
6. Delete iframe routing only after portrait, touchstones, notes, and character save/load are React-native.

## Interaction Standards

- Left-click selects, double-click edits image media.
- Right-click opens the compact smart menu.
- Drag into canvas places media at cursor.
- Drag into library saves off-canvas.
- Drag layer rows reorders or folders them.
- `Ctrl+K`: media search.
- `Ctrl+Shift+I`: inspector/layers.

## Future tldraw Integration

The existing hand-rolled canvas is already synchronized with Supabase and is safer to evolve incrementally. If tldraw becomes the primary canvas:

- Map each `table_images` row to a custom TL shape.
- Keep Supabase as durable storage, tldraw as interaction/render engine.
- Use tldraw presence for cursor/selection only.
- Continue storing media binaries in Supabase Storage.

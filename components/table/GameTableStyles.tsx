export default function GameTableStyles() {
  return (
    <>
      <style jsx global>{`
        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          min-height: 100vh !important;
          background: #090909 !important;
          color: #f4f4f4 !important;
          display: block !important;
          overflow: hidden !important;
        }
      `}</style>
      <style jsx global>{`
        .table-page-shell {
          height: 100vh;
          padding: 18px;
          font-family: "Courier New", Courier, monospace;
          background:
            linear-gradient(180deg, rgba(120, 0, 0, 0.16), rgba(0, 0, 0, 0) 250px),
            #090909;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          overflow: hidden;
        }

        .table-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin: 0 auto 14px;
          border-bottom: 1px solid #2d2d2d;
          padding-bottom: 12px;
        }

        .table-kicker {
          margin: 0 0 5px;
          color: #ff3131;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-size: 12px;
        }

        h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 46px);
          letter-spacing: 0;
        }

        .table-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .table-actions > input[type="file"] {
          display: none;
        }

        .table-actions a,
        .table-actions button {
          border: 1px solid #773030;
          background: #141414;
          color: #f5f5f5;
          border-radius: 6px;
          padding: 9px 12px;
          font: inherit;
          text-decoration: none;
          cursor: pointer;
        }

        .table-actions button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .role-pill {
          border-color: #36d675 !important;
          color: #dfffe9 !important;
        }

        .master-password-control {
          display: grid;
          grid-template-columns: auto minmax(90px, 140px) auto;
          gap: 6px;
          align-items: center;
          color: #a9a9a9;
          font-size: 11px;
        }

        .master-password-control input {
          height: 34px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #0c0c0c;
          color: #f4f4f4;
          padding: 0 8px;
          font: inherit;
          font-size: 12px;
        }

        .active-character-strip {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 12px;
          margin: 0 auto 12px;
        }

        .active-character-card,
        .active-character-picker {
          border: 1px solid #2b2b2b;
          border-radius: 8px;
          background: #101010;
          padding: 10px;
        }

        .active-character-card {
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr) auto auto;
          gap: 10px;
          align-items: center;
        }

        .active-character-card div:nth-child(2),
        .active-character-picker label {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .active-character-card span,
        .active-character-picker span,
        .active-character-card small {
          color: #9c9c9c;
          font-size: 12px;
        }

        .active-character-card strong {
          color: #f4f4f4;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .active-character-card a,
        .active-character-card button,
        .active-character-picker button,
        .active-character-picker select {
          min-width: 0;
          min-height: 34px;
          border: 1px solid #773030;
          border-radius: 6px;
          background: #171717;
          color: #f4f4f4;
          padding: 8px 10px;
          font: inherit;
          font-size: 12px;
          text-decoration: none;
          cursor: pointer;
        }

        .active-character-card button:disabled,
        .active-character-picker select:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .active-character-picker {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: end;
        }

        .table-layout {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 420px;
          gap: 12px;
          flex: 1;
          min-height: 0;
        }

        .table-layout.with-left-toolbar {
          grid-template-columns: 330px minmax(0, 1fr) 420px;
        }

        .table-layout.right-collapsed {
          grid-template-columns: minmax(0, 1fr);
        }

        .table-layout.with-left-toolbar.right-collapsed {
          grid-template-columns: 330px minmax(0, 1fr);
        }

        .play-surface,
        .music-dock,
        .left-toolbar,
        .media-sidebar,
        .layer-panel,
        .roll-sidebar,
        .chat-sidebar {
          border: 1px solid #2b2b2b;
          background: #101010;
          border-radius: 8px;
          overflow: hidden;
        }

        .play-surface {
          position: relative;
          min-width: 0;
          display: grid;
          grid-template-rows: auto 1fr;
        }

        .music-dock {
          min-width: 0;
          min-height: 0;
        }

        .column-edge-toggle {
          position: absolute;
          z-index: 60;
          width: 24px;
          height: 44px;
          border: 1px solid #333;
          border-radius: 5px;
          background: rgba(14,14,14,0.92);
          display: grid;
          place-content: center;
          gap: 3px;
          padding: 0;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(0,0,0,0.36);
        }

        .column-edge-toggle span {
          display: block;
          width: 13px;
          height: 2px;
          border-radius: 2px;
          background: #bdbdbd;
        }

        .column-edge-toggle:hover {
          border-color: #ff3131;
        }

        .master-toggle {
          left: 318px;
          top: 50%;
          transform: translateY(-50%);
        }

        .left-collapsed .master-toggle {
          left: 0;
        }

        .right-toggle {
          right: 406px;
          top: 50%;
          transform: translateY(-50%);
        }

        .right-collapsed .right-toggle {
          right: 0;
        }

        .left-toolbar {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
        }

        .panel-collapsed {
          opacity: 0;
          pointer-events: none;
          border: 0;
          min-width: 0;
        }

        .left-tabs {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 4px;
          padding: 4px;
          border-bottom: 1px solid #2b2b2b;
          background: #101010;
        }

        .left-tabs button {
          min-width: 0;
          height: 34px;
          border: 1px solid transparent;
          border-radius: 5px;
          background: transparent;
          color: #a9a9a9;
          cursor: pointer;
          font: inherit;
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .left-tabs button.active {
          border-color: #773030;
          background: #221414;
          color: #ffd7d7;
        }

        .scene-control-panel,
        .scene-layer-panel,
        .scene-media-panel {
          min-height: 0;
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          background: #101010;
        }

        .scene-control-panel {
          grid-template-rows: auto auto minmax(150px, 0.85fr) minmax(210px, 1fr);
        }

        .scene-media-panel {
          grid-template-rows: auto auto auto auto minmax(0, 1fr);
        }

        .scene-control-panel > header,
        .scene-layer-panel > header,
        .scene-media-panel > header,
        .scene-music-box > header {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          border-bottom: 1px solid #2b2b2b;
          background: #111;
          padding: 10px;
        }

        .scene-control-panel header div,
        .scene-music-box header {
          min-width: 0;
        }

        .scene-control-panel span,
        .scene-layer-panel span,
        .scene-media-panel span,
        .scene-music-box span {
          color: #9c9c9c;
          font-size: 11px;
        }

        .scene-control-panel strong,
        .scene-layer-panel strong,
        .scene-media-panel strong,
        .scene-music-box strong {
          min-width: 0;
          color: #f5f5f5;
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scene-toolbar {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          padding: 8px;
          border-bottom: 1px solid #2b2b2b;
          background: #171717;
        }

        .scene-toolbar button,
        .scene-list-row button,
        .scene-track-row button {
          min-width: 0;
          height: 30px;
          border: 1px solid #773030;
          border-radius: 5px;
          background: #1b1b1b;
          color: #f4f4f4;
          padding: 0 8px;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .scene-toolbar button:disabled,
        .scene-list-row button:disabled,
        .scene-track-row button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .scene-list,
        .scene-track-list,
        .scene-layer-groups {
          min-height: 0;
          overflow-y: auto;
        }

        .scene-list-row {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) 74px;
          gap: 8px;
          align-items: center;
          min-height: 58px;
          padding: 7px 8px;
          border-bottom: 1px solid #292929;
          background: #161616;
          cursor: pointer;
        }

        .scene-list-row:hover,
        .scene-list-row.selected {
          background: #242424;
        }

        .scene-list-row.active {
          box-shadow: inset 3px 0 0 #36d675;
        }

        .scene-thumb {
          width: 44px;
          height: 38px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #090909;
          display: grid;
          place-items: center;
          overflow: hidden;
          color: #ffb3b3;
          font-weight: 700;
        }

        .scene-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .scene-list-row div:nth-child(2),
        .scene-track-row div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .scene-music-box {
          min-height: 0;
          display: grid;
          grid-template-rows: auto auto auto minmax(0, 1fr);
          border-top: 1px solid #2b2b2b;
        }

        .scene-music-actions {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
          padding: 8px;
          border-bottom: 1px solid #292929;
          background: #151515;
        }

        .scene-music-actions button {
          min-width: 0;
          height: 30px;
          border: 1px solid #773030;
          border-radius: 5px;
          background: #1b1b1b;
          color: #f4f4f4;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .scene-music-actions span {
          text-align: right;
        }

        .scene-track-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) repeat(7, 24px);
          gap: 4px;
          align-items: center;
          padding: 7px 8px;
          border-bottom: 1px solid #292929;
          background: #141414;
        }

        .scene-track-row button {
          width: 24px;
          padding: 0;
        }

        .scene-track-row button.danger {
          color: #ff9c9c;
          border-color: #6a2727;
        }

        .scene-media-drop-zone {
          outline: 1px dashed rgba(255,255,255,0.08);
          outline-offset: -8px;
        }

        .scene-layer-groups {
          display: grid;
          align-content: start;
          gap: 0;
        }

        .scene-layer-groups details {
          border-bottom: 1px solid #2b2b2b;
          background: #121212;
        }

        .scene-layer-groups summary {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          padding: 9px 10px;
          cursor: pointer;
          color: #f1f1f1;
          font-size: 12px;
        }

        .scene-layer-groups summary span {
          color: #36d675;
        }

        .surface-head,
        .layer-panel header,
        .roll-sidebar header,
        .chat-sidebar header {
          border-bottom: 1px solid #2b2b2b;
          background: #111;
        }

        .surface-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 14px;
          align-items: center;
        }

        .surface-head div {
          display: grid;
          gap: 4px;
        }

        .surface-head span,
        .layer-panel header span,
        .roll-sidebar header span,
        .chat-sidebar header span {
          color: #9c9c9c;
          font-size: 12px;
        }

        .surface-head strong,
        .layer-panel header strong,
        .roll-sidebar header strong,
        .chat-sidebar header strong {
          color: #f5f5f5;
          font-size: 15px;
        }

        .zoom-tools {
          display: flex !important;
          gap: 6px !important;
          align-items: center;
        }

        .zoom-tools button {
          width: 34px;
          height: 30px;
          border-radius: 5px;
          border: 1px solid #333;
          background: #181818;
          color: #f4f4f4;
          cursor: pointer;
          font: inherit;
        }

        .hand-notice {
          position: absolute;
          left: 50%;
          top: 74px;
          z-index: 80;
          transform: translateX(-50%);
          border: 1px solid #ff3131;
          border-radius: 6px;
          background: rgba(18, 6, 6, 0.94);
          color: #ffe2e2;
          padding: 9px 14px;
          font-size: 13px;
          box-shadow: 0 16px 38px rgba(0,0,0,0.42), 0 0 26px rgba(255,49,49,0.22);
          pointer-events: none;
        }

        .scene {
          position: relative;
          min-height: 0;
          overflow: hidden;
          touch-action: none;
          overscroll-behavior: contain;
          background-color: #080808;
          background-image:
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 32px 32px;
          cursor: grab;
        }

        .scene:active {
          cursor: grabbing;
        }

        .scene.drag-over {
          outline: 2px solid #36d675;
          outline-offset: -2px;
        }

        .scene-world {
          position: absolute;
          inset: 0;
          width: 4000px;
          height: 3000px;
          transform-origin: 0 0;
        }

        .scene-empty {
          position: absolute;
          inset: 20px;
          display: grid;
          place-content: center;
          text-align: center;
          color: #aaa;
          border: 1px dashed #3a3a3a;
          border-radius: 8px;
          pointer-events: none;
        }

        .scene-empty h2 {
          margin: 0 0 8px;
          color: #fff;
          letter-spacing: 0;
          text-transform: none;
          border: 0;
          padding: 0;
        }

        .scene-empty p {
          margin: 0;
          max-width: 500px;
        }

        .scene-layer {
          position: absolute;
          border: 1px solid transparent;
          background: transparent;
          user-select: none;
          touch-action: none;
          cursor: move;
          box-shadow: 0 10px 30px rgba(0,0,0,0.28);
          overflow: hidden;
        }

        .image-layer {
          background: transparent;
          box-shadow: none;
        }

        .scene-layer.selected {
          border-color: #36d675;
          box-shadow: 0 0 0 2px rgba(54, 214, 117, 0.2), 0 12px 34px rgba(0,0,0,0.36);
        }

        .scene-layer.locked {
          cursor: default;
          opacity: 0.82;
        }

        .selection-rect {
          position: absolute;
          z-index: 9999;
          border: 1px solid #9ab7ff;
          background: rgba(154, 183, 255, 0.16);
          pointer-events: none;
        }

        .scene-layer img,
        .scene-layer video,
        .scene-layer iframe {
          width: 100%;
          height: 100%;
          display: block;
        }

        .scene-layer img,
        .scene-layer video {
          object-fit: fill;
        }

        .scene-layer img {
          pointer-events: none;
        }

        .scene-layer video,
        .scene-layer iframe,
        .video-layer {
          background: #050505;
        }

        .cropped-layer img,
        .cropped-layer video {
          max-width: none;
          max-height: none;
          object-fit: fill;
        }

        .scene-layer iframe {
          border: 0;
        }

        .inline-crop-surface {
          position: absolute;
          inset: 0;
          z-index: 8;
          touch-action: none;
          cursor: default;
        }

        .inline-crop-box {
          position: absolute;
          border: 2px solid #fff;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.52), inset 0 0 0 1px rgba(255,255,255,0.15);
          cursor: move;
          touch-action: none;
        }

        /* Rule-of-thirds horizontal lines */
        .inline-crop-box::before,
        .inline-crop-box::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          border-top: 1px solid rgba(255,255,255,0.3);
          pointer-events: none;
        }

        .inline-crop-box::before { top: 33.333%; }
        .inline-crop-box::after  { top: 66.666%; }

        /* Crop handles — corners */
        .crop-handle {
          position: absolute;
          width: 12px;
          height: 12px;
          background: #fff;
          border: 2px solid rgba(0,0,0,0.6) !important;
          border-radius: 2px;
          padding: 0 !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.5);
        }

        .crop-handle.nw { left: -7px;  top: -7px;    cursor: nwse-resize; }
        .crop-handle.ne { right: -7px; top: -7px;    cursor: nesw-resize; }
        .crop-handle.sw { left: -7px;  bottom: -7px; cursor: nesw-resize; }
        .crop-handle.se { right: -7px; bottom: -7px; cursor: nwse-resize; }

        /* Crop handles — edges */
        .crop-handle.n,
        .crop-handle.s {
          width: 32px;
          height: 8px;
          left: 50%;
          transform: translateX(-50%);
          border-radius: 4px;
          cursor: ns-resize;
        }
        .crop-handle.n { top: -5px; }
        .crop-handle.s { bottom: -5px; }

        .crop-handle.e,
        .crop-handle.w {
          width: 8px;
          height: 32px;
          top: 50%;
          transform: translateY(-50%);
          border-radius: 4px;
          cursor: ew-resize;
        }
        .crop-handle.e { right: -5px; }
        .crop-handle.w { left: -5px; }

        /* Toolbar — inside the layer at the bottom so overflow:hidden doesn't clip it */
        .inline-crop-toolbar,
        .inline-opacity-control {
          position: absolute;
          left: 50%;
          bottom: 10px;
          transform: translateX(-50%);
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 6px;
          max-width: min(400px, 92%);
          padding: 6px 8px;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 6px;
          background: rgba(10,10,10,0.92);
          box-shadow: 0 4px 18px rgba(0,0,0,0.6);
          white-space: nowrap;
        }

        .inline-crop-toolbar button {
          height: 30px;
          border: 1px solid #444;
          border-radius: 4px;
          background: #222;
          color: #f4f4f4;
          padding: 0 12px;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }

        .inline-crop-toolbar button:first-child {
          background: #1a3a1a;
          border-color: #36d675;
          color: #36d675;
        }

        .inline-crop-toolbar button:first-child:hover {
          background: #204a20;
        }

        .inline-crop-toolbar button:hover {
          border-color: #ff3131;
          background: #2a1111;
        }

        .inline-crop-toolbar button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .inline-opacity-control {
          width: 220px;
          bottom: auto;
          top: calc(100% + 10px);
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
        }

        .inline-opacity-control span {
          color: #cfcfcf;
          font-size: 11px;
        }

        .inline-opacity-control input {
          width: 100%;
          accent-color: #ff3131;
        }

        .text-layer {
          background: #030303;
          border: 1px solid #ff3131;
          box-shadow: 0 0 18px rgba(255,49,49,0.55), 0 12px 34px rgba(0,0,0,0.42);
        }

        .scene-text-material {
          width: 100%;
          height: 100%;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 10px;
          padding: 18px;
          box-sizing: border-box;
          color: #ffffff;
          overflow: hidden;
        }

        .scene-text-material strong {
          color: #ffb3b3;
          font-size: 15px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scene-text-material div {
          margin: 0;
          overflow: auto;
          line-height: 1.45;
          font-size: 14px;
          user-select: text;
          cursor: text;
        }

        .scene-text-material pre {
          margin: 0;
          white-space: pre-wrap;
          font: inherit;
        }

        .scene-text-material img {
          max-width: 100%;
          height: auto;
          object-fit: contain;
          pointer-events: none;
        }

        .scene-file-material {
          width: 100%;
          height: 100%;
          display: grid;
          align-content: center;
          gap: 10px;
          padding: 18px;
          box-sizing: border-box;
          color: #ffffff;
          background: #030303;
          border: 1px solid #ff3131;
          box-shadow: inset 0 0 20px rgba(255,49,49,0.18);
        }

        .scene-file-material.embedded-document {
          align-content: stretch;
          grid-template-rows: auto minmax(0, 1fr);
          padding: 10px;
        }

        .scene-file-material strong {
          color: #ffb3b3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scene-file-material span {
          color: #aaa;
          font-size: 12px;
        }

        .scene-file-material a {
          width: fit-content;
          border: 1px solid #773030;
          border-radius: 5px;
          color: #fff;
          background: #171717;
          padding: 8px 10px;
          text-decoration: none;
          font-size: 12px;
        }

        .scene-file-material iframe {
          width: 100%;
          height: 100%;
          min-height: 0;
          border: 1px solid rgba(255,49,49,0.32);
          border-radius: 4px;
          background: #111;
        }

        .embedded-video-drag-handle {
          position: absolute;
          left: 8px;
          top: 8px;
          width: 30px;
          height: 30px;
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 5px;
          background: rgba(0,0,0,0.68);
          color: #f4f4f4;
          display: grid;
          place-items: center;
          font: inherit;
          line-height: 1;
          cursor: move;
          opacity: 0.72;
          z-index: 2;
        }

        .embedded-video-drag-handle:hover,
        .scene-layer.selected .embedded-video-drag-handle {
          opacity: 1;
        }

        .folder-layer {
          background: transparent;
          border-color: rgba(54, 214, 117, 0.45);
          box-shadow: inset 0 0 0 1px rgba(54, 214, 117, 0.08);
        }

        .folder-surface {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: flex-start;
          padding: 9px 10px;
          box-sizing: border-box;
          color: #36d675;
          background: transparent;
          pointer-events: none;
        }

        .folder-surface span {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          background: rgba(0,0,0,0.38);
          border: 1px solid rgba(54, 214, 117, 0.28);
          border-radius: 4px;
          padding: 4px 6px;
        }

        .broken-image-label {
          display: none;
          position: absolute;
          inset: 0;
          place-content: center;
          padding: 18px;
          color: #aaa;
          text-align: center;
          font-size: 13px;
          background: #080808;
        }

        .scene-layer.image-load-error .broken-image-label {
          display: grid;
        }

        .resize-handle {
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid #0b0b0b;
          background: #36d675;
        }

        .resize-handle.nw {
          left: -7px;
          top: -7px;
          cursor: nwse-resize;
        }

        .resize-handle.ne {
          right: -7px;
          top: -7px;
          cursor: nesw-resize;
        }

        .resize-handle.sw {
          left: -7px;
          bottom: -7px;
          cursor: nesw-resize;
        }

        .resize-handle.se {
          right: -7px;
          bottom: -7px;
          cursor: nwse-resize;
        }

        .right-rail {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 12px;
          overflow: hidden;
        }

        .right-tabs {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 4px;
          padding: 4px;
          border: 1px solid #2b2b2b;
          border-radius: 8px;
          background: #101010;
        }

        .right-tabs button {
          min-width: 0;
          height: 34px;
          border: 1px solid transparent;
          border-radius: 5px;
          background: transparent;
          color: #a9a9a9;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .right-tabs button.active {
          border-color: #3b3b3b;
          background: #242424;
          color: #f4f4f4;
        }

        .sub-tabs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
          gap: 4px;
          padding: 4px;
          border-bottom: 1px solid #2b2b2b;
          background: #101010;
        }

        .sub-tabs button {
          min-width: 0;
          height: 32px;
          border: 1px solid transparent;
          border-radius: 5px;
          background: transparent;
          color: #a9a9a9;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sub-tabs button.active {
          border-color: #3b3b3b;
          background: #242424;
          color: #f4f4f4;
        }

        .media-sidebar {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
        }

        .media-sidebar > .table-right-panel {
          min-height: 0;
          border: 0;
          border-radius: 0;
        }

        .layer-panel,
        .library-panel {
          display: grid;
          grid-template-rows: auto auto auto minmax(0, 1fr);
        }

        .library-panel {
          grid-template-rows: auto auto auto auto minmax(0, 1fr);
        }

        .table-right-panel {
          width: 100%;
          min-width: 0;
          min-height: 0;
          align-self: stretch;
        }

        .table-right-panel-hidden {
          display: none !important;
        }

        .layer-list,
        .roll-list,
        .chat-list {
          min-height: 0;
          height: 100%;
          overflow-y: auto;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .layer-list.drop-root {
          box-shadow: inset 0 -2px 0 rgba(123, 168, 255, 0.8);
        }

        .panel-empty {
          margin: auto;
          color: #888;
          text-align: center;
          font-size: 13px;
          padding: 20px;
        }

        .media-manager-toolbar {
          display: flex;
          gap: 6px;
          padding: 8px;
          border-bottom: 1px solid #2b2b2b;
          background: #171717;
        }

        .media-manager-toolbar button,
        .text-material-form button,
        .library-card button {
          height: 32px;
          border: 1px solid #773030;
          border-radius: 5px;
          background: #1b1b1b;
          color: #f4f4f4;
          padding: 0 10px;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        .media-manager-toolbar button:disabled,
        .text-material-form button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .media-url-form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 6px;
          padding: 8px;
          border-bottom: 1px solid #2b2b2b;
          background: #141414;
        }

        .media-url-form input {
          min-width: 0;
          height: 34px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #0c0c0c;
          color: #f4f4f4;
          padding: 0 10px;
          font: inherit;
          font-size: 12px;
        }

        .media-url-form input:disabled {
          opacity: 0.6;
        }

        .media-url-form button {
          height: 34px;
          border: 1px solid #773030;
          border-radius: 5px;
          background: #1b1b1b;
          color: #f4f4f4;
          padding: 0 10px;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        .media-url-form button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .media-search-input {
          min-width: 0;
          height: 34px;
          border: 0;
          border-bottom: 1px solid #2b2b2b;
          background: #0c0c0c;
          color: #f4f4f4;
          padding: 0 11px;
          font: inherit;
          font-size: 12px;
          outline: none;
        }

        .media-search-input:focus {
          box-shadow: inset 3px 0 0 #ff3131;
        }

        .layer-row {
          position: relative;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          width: 100%;
          min-height: 44px;
          max-height: 44px;
          border: 0;
          border-bottom: 1px solid #2b2b2b;
          border-radius: 0;
          background: #303030;
          overflow: visible;
          color: #eeeeee;
          cursor: default;
        }

        .layer-row:hover {
          background: #393939;
        }

        .layer-row.active {
          background: #4b4b4b;
          box-shadow: inset 3px 0 0 #9ab7ff;
        }

        .layer-row.hidden {
          color: #888;
          background: #262626;
        }

        .layer-row.dragging {
          opacity: 0.42;
        }

        .layer-row.drop-before::before,
        .layer-row.drop-after::after {
          content: "";
          position: absolute;
          left: 34px;
          right: 0;
          height: 2px;
          background: #7ba8ff;
          box-shadow: 0 0 10px rgba(123, 168, 255, 0.45);
          z-index: 2;
        }

        .layer-row.drop-before::before {
          top: -2px;
        }

        .layer-row.drop-after::after {
          bottom: -2px;
        }

        .layer-row.drop-inside {
          outline: 1px solid rgba(123, 168, 255, 0.9);
          outline-offset: -3px;
          background: rgba(123, 168, 255, 0.16);
        }

        .layer-visibility {
          width: 100%;
          min-height: 44px;
          border: 0;
          border-right: 1px solid #262626;
          background: transparent;
          color: #dcdcdc;
          cursor: pointer;
          font: inherit;
          display: grid;
          place-items: center;
        }

        .layer-visibility span {
          position: relative;
          width: 17px;
          height: 11px;
          border: 1.8px solid currentColor;
          border-radius: 50%;
          box-sizing: border-box;
        }

        .layer-visibility span::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
          transform: translate(-50%, -50%);
        }

        .layer-visibility:not(.visible) {
          color: #5f5f5f;
        }

        .layer-name {
          width: 100%;
          min-height: 44px;
          max-height: 44px;
          color: #f1f1f1;
          display: grid;
          grid-template-columns: 18px 36px minmax(0, 1fr) auto;
          gap: 7px;
          align-items: center;
          padding: 4px 8px 4px 0;
          box-sizing: border-box;
        }

        .folder-toggle {
          width: 18px;
          height: 32px;
          border: 0;
          background: transparent;
          color: #bdbdbd;
          display: grid;
          place-items: center;
          padding: 0;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .folder-toggle.spacer {
          pointer-events: none;
        }

        .layer-thumb {
          min-width: 0;
          width: 36px !important;
          height: 32px !important;
          min-width: 36px !important;
          min-height: 32px !important;
          max-width: 36px !important;
          max-height: 32px !important;
          display: grid;
          place-items: center;
          border: 1px solid #181818;
          background-color: #f4f4f4;
          background-image:
            linear-gradient(45deg, #d8d8d8 25%, transparent 25%),
            linear-gradient(-45deg, #d8d8d8 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #d8d8d8 75%),
            linear-gradient(-45deg, transparent 75%, #d8d8d8 75%);
          background-size: 10px 10px;
          background-position: 0 0, 0 5px, 5px -5px, -5px 0;
          box-shadow: 0 0 0 1px #3f3f3f;
          overflow: hidden !important;
          flex: 0 0 36px !important;
        }

        .layer-thumb img {
          width: 100% !important;
          height: 100% !important;
          min-width: 0 !important;
          min-height: 0 !important;
          max-width: 36px !important;
          max-height: 32px !important;
          object-fit: cover;
          display: block;
          pointer-events: none;
        }

        .video-thumb {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: #131722;
          color: #9ab7ff;
          font-size: 12px;
        }

        .text-thumb,
        .file-thumb {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: #070707;
          color: #ffb3b3;
          border: 1px solid rgba(255,49,49,0.5);
          box-shadow: inset 0 0 14px rgba(255,49,49,0.2);
          font-weight: 700;
        }

        .folder-thumb {
          position: relative;
          width: 24px;
          height: 17px;
          display: block;
          background: #c9a557;
          border-radius: 2px;
          border: 1px solid #8b7034;
          font-size: 0;
        }

        .folder-thumb::before {
          content: "";
          position: absolute;
          left: 1px;
          top: -5px;
          width: 11px;
          height: 6px;
          border-radius: 2px 2px 0 0;
          background: #d7b562;
          border: 1px solid #8b7034;
          border-bottom: 0;
        }

        .layer-title {
          min-width: 0;
          display: grid;
          gap: 1px;
        }

        .layer-title span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0;
        }

        .layer-title small {
          min-width: 0;
          color: #989898;
          font-size: 10px;
          line-height: 1.1;
          text-transform: uppercase;
        }

        .layer-quick-actions {
          display: flex;
          gap: 5px;
          align-items: center;
        }

        .lock-indicator {
          color: #d6d6d6;
          font-size: 11px;
        }

        .layer-quick-actions button {
          width: 20px;
          height: 20px;
          border: 1px solid #3a3a3a;
          border-radius: 3px;
          background: #272727;
          color: #cfcfcf;
          font: inherit;
          font-size: 10px;
          padding: 0;
          cursor: pointer;
        }

        .layer-quick-actions button.danger {
          color: #ff9c9c;
          border-color: #5d2929;
        }

        .layer-quick-actions button:hover,
        .folder-toggle:hover,
        .layer-visibility:hover {
          color: #ffffff;
        }

        .layer-children {
          display: grid;
          gap: 0;
          margin-top: 0;
        }

        .layer-root-drop-zone {
          min-height: 34px;
          display: grid;
          place-items: center;
          color: #777;
          font-size: 11px;
          border-top: 1px dashed #333;
        }

        .layer-list.drop-root .layer-root-drop-zone {
          color: #c7d7ff;
          background: rgba(123, 168, 255, 0.09);
        }

        .layer-context-menu {
          position: fixed;
          z-index: 1000;
          min-width: 190px;
          max-height: calc(100vh - 16px);
          overflow-y: auto;
          padding: 5px;
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          background: #151515;
          box-shadow: 0 16px 40px rgba(0,0,0,0.45);
          display: grid;
          gap: 2px;
        }

        .layer-context-menu button {
          border: 0;
          border-radius: 4px;
          background: transparent;
          color: #eee;
          padding: 8px 10px;
          text-align: left;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .layer-context-menu button:hover {
          background: #242424;
        }

        .layer-context-menu button.danger {
          color: #ff8b8b;
        }

        .media-preview-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1900;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(0,0,0,0.78);
        }

        .media-preview-modal {
          width: min(980px, 100%);
          height: min(760px, 90vh);
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          background: #0b0b0b;
          box-shadow: 0 24px 70px rgba(0,0,0,0.65), 0 0 28px rgba(255,49,49,0.18);
          overflow: hidden;
        }

        .character-preview-modal {
          width: min(760px, 100%);
          max-height: min(760px, 90vh);
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          background: #0b0b0b;
          box-shadow: 0 24px 70px rgba(0,0,0,0.65), 0 0 28px rgba(255,49,49,0.18);
          overflow: hidden;
        }

        .character-preview-modal header {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          padding: 12px 14px;
          border-bottom: 1px solid #2b2b2b;
          background: #111;
        }

        .character-preview-modal header button {
          width: 34px;
          height: 34px;
          border: 1px solid #3a3a3a;
          border-radius: 5px;
          background: #181818;
          color: #fff;
          cursor: pointer;
          font: inherit;
          font-size: 22px;
          line-height: 1;
        }

        .character-preview-identity {
          min-width: 0;
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
        }

        .character-preview-identity > div:last-child {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .character-preview-grid {
          min-height: 0;
          overflow-y: auto;
          display: grid;
          gap: 12px;
          padding: 14px;
        }

        .character-preview-grid section {
          border: 1px solid #292929;
          border-radius: 8px;
          background: #141414;
          padding: 12px;
        }

        .character-preview-grid h3 {
          margin: 0 0 8px;
          color: #ffb3b3;
          font-size: 13px;
        }

        .character-preview-grid p {
          margin: 0 0 6px;
          color: #d7d7d7;
          font-size: 13px;
          line-height: 1.45;
        }

        .character-preview-grid ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 6px;
        }

        .character-preview-grid li {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border-bottom: 1px solid #252525;
          padding-bottom: 6px;
          color: #ddd;
          font-size: 12px;
        }

        .character-preview-grid li span {
          color: #9c9c9c;
        }

        .mechanics-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 7px;
        }

        .mechanics-list span {
          min-width: 0;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border-bottom: 1px solid #252525;
          padding-bottom: 5px;
          color: #ddd;
          font-size: 12px;
        }

        .mechanics-list b {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mechanics-list i {
          color: #ffb3b3;
          font-style: normal;
          text-align: right;
        }

        .quick-roll-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .quick-roll-grid button {
          min-height: 34px;
          border: 1px solid #773030;
          border-radius: 6px;
          background: #1d1d1d;
          color: #f4f4f4;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .character-preview-actions {
          border-top: 1px solid #292929;
          background: #111;
          padding: 10px;
        }

        .media-preview-modal header {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          padding: 12px 14px;
          border-bottom: 1px solid #2b2b2b;
          background: #111;
        }

        .media-preview-modal header div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .media-preview-modal header span {
          color: #ff7777;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .media-preview-modal header strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #fff;
        }

        .media-preview-modal header button {
          width: 34px;
          height: 34px;
          border: 1px solid #3a3a3a;
          border-radius: 5px;
          background: #181818;
          color: #fff;
          cursor: pointer;
          font: inherit;
          font-size: 22px;
          line-height: 1;
        }

        .media-preview-body {
          min-height: 0;
          display: grid;
          place-items: center;
          padding: 14px;
          overflow: auto;
        }

        .media-preview-body img,
        .media-preview-body video,
        .media-preview-body iframe {
          width: 100%;
          height: 100%;
          max-height: 100%;
          object-fit: contain;
          border: 0;
          background: #050505;
        }

        .preview-text-material,
        .preview-file-card {
          width: min(720px, 100%);
          max-height: 100%;
          overflow: auto;
          border: 1px solid #ff3131;
          border-radius: 6px;
          background: #030303;
          color: #fff;
          padding: 18px;
          box-shadow: 0 0 18px rgba(255,49,49,0.45);
          line-height: 1.5;
        }

        .preview-text-material pre {
          margin: 0;
          white-space: pre-wrap;
          font: inherit;
        }

        .preview-text-material img {
          max-width: 100%;
          height: auto;
        }

        .preview-file-card {
          display: grid;
          gap: 10px;
          align-content: center;
        }

        .preview-file-card span {
          color: #aaa;
          font-size: 12px;
        }

        .preview-file-card a {
          width: fit-content;
          border: 1px solid #773030;
          border-radius: 5px;
          background: #171717;
          color: #fff;
          padding: 8px 10px;
          text-decoration: none;
        }

        .context-menu-group {
          display: grid;
          gap: 2px;
          border-top: 1px solid #2a2a2a;
          border-bottom: 1px solid #2a2a2a;
          padding: 4px 0;
        }

        .context-menu-group span {
          color: #8f8f8f;
          font-size: 10px;
          padding: 4px 10px 2px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .context-menu-controls label {
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          padding: 4px 10px;
        }

        .context-menu-controls small {
          color: #b8b8b8;
          font-size: 11px;
        }

        .context-menu-controls input,
        .context-menu-controls select {
          min-width: 0;
          width: 100%;
          accent-color: #ff3131;
          border: 1px solid #333;
          border-radius: 4px;
          background: #090909;
          color: #eee;
          font: inherit;
          font-size: 11px;
        }

        .image-editor-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1950;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(0,0,0,0.86);
          backdrop-filter: blur(8px);
        }

        .image-editor-modal {
          width: min(1180px, 100%);
          height: min(820px, 92vh);
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          border: 1px solid #4b1f1f;
          border-radius: 8px;
          background: #0b0b0b;
          box-shadow: 0 28px 80px rgba(0,0,0,0.72), 0 0 38px rgba(255,49,49,0.2);
          overflow: hidden;
        }

        .image-editor-modal header {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          border-bottom: 1px solid #2b2b2b;
          background: linear-gradient(180deg, #151515, #101010);
          padding: 10px 12px;
        }

        .image-editor-modal header div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .image-editor-modal header span {
          color: #ff5858;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }

        .image-editor-modal header strong {
          min-width: 0;
          color: #fff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .image-editor-modal header nav {
          display: flex;
          gap: 7px;
          align-items: center;
          overflow-x: auto;
        }

        .image-editor-modal button,
        .image-editor-tools button {
          min-width: 0;
          height: 32px;
          border: 1px solid #3a3a3a;
          border-radius: 5px;
          background: #181818;
          color: #f4f4f4;
          padding: 0 10px;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }

        .image-editor-modal button:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .image-editor-modal button.primary {
          border-color: #ff3131;
          background: #361414;
          color: #ffe1e1;
        }

        .image-editor-body {
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 260px;
          background: #070707;
        }

        .crop-stage {
          position: relative;
          min-height: 0;
          margin: 16px;
          border: 1px solid #252525;
          background:
            linear-gradient(45deg, #111 25%, transparent 25%),
            linear-gradient(-45deg, #111 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #111 75%),
            linear-gradient(-45deg, transparent 75%, #111 75%),
            #050505;
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0;
          overflow: hidden;
          touch-action: none;
        }

        .crop-stage img,
        .crop-stage video {
          width: 100%;
          height: 100%;
          object-fit: fill;
          max-width: none;
          max-height: none;
          display: block;
          user-select: none;
          pointer-events: none;
        }

        .crop-mask {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.34);
          pointer-events: none;
        }

        .crop-box {
          position: absolute;
          border: 1px solid #ffffff;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,49,49,0.8);
          cursor: move;
          touch-action: none;
        }

        .crop-box::before,
        .crop-box::after {
          content: "";
          position: absolute;
          inset: 33.333% 0 auto;
          border-top: 1px solid rgba(255,255,255,0.44);
          pointer-events: none;
        }

        .crop-box::after {
          inset: 66.666% 0 auto;
        }

        /* .crop-handle styles defined above in inline-crop section */

        .image-editor-tools {
          min-height: 0;
          display: grid;
          align-content: start;
          gap: 10px;
          padding: 14px;
          border-left: 1px solid #2b2b2b;
          background: #111;
        }

        .tool-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .editor-slider {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 54px;
          gap: 7px;
          align-items: center;
          border-top: 1px solid #252525;
          padding-top: 10px;
        }

        .editor-slider span {
          grid-column: 1 / -1;
          color: #c8c8c8;
          font-size: 12px;
        }

        .editor-slider input {
          width: 100%;
          accent-color: #ff3131;
        }

        .editor-slider strong {
          color: #fff;
          font-size: 12px;
          text-align: right;
        }

        .text-material-form {
          display: grid;
          gap: 7px;
          padding: 8px;
          border-bottom: 1px solid #2b2b2b;
          background: #141414;
        }

        .text-material-form input,
        .text-material-form textarea {
          min-width: 0;
          border: 1px solid #333;
          border-radius: 5px;
          background: #0c0c0c;
          color: #f4f4f4;
          padding: 8px 10px;
          font: inherit;
          font-size: 12px;
          resize: vertical;
        }

        .library-grid {
          min-height: 0;
          overflow-y: auto;
          padding: 10px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-content: start;
          gap: 10px;
        }

        .library-list {
          background: #171717;
        }

        .library-card {
          min-width: 0;
          display: grid;
          gap: 7px;
          border: 1px solid #303030;
          border-radius: 7px;
          background: #171717;
          padding: 8px;
          cursor: grab;
        }

        .library-card.active {
          border-color: #9ab7ff;
          box-shadow: 0 0 0 1px rgba(154,183,255,0.35);
        }

        .library-preview {
          aspect-ratio: 4 / 3;
          border: 1px solid #222;
          background: #0b0b0b;
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .library-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .library-card strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
        }

        .library-card-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .library-card button.danger {
          color: #ff9c9c;
          border-color: #6a2727;
        }

        .role-gate {
          position: fixed;
          inset: 0;
          z-index: 2000;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(0,0,0,0.82);
        }

        .role-gate section {
          width: min(460px, 100%);
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          background: #111;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.55);
        }

        .role-gate span {
          color: #ff3131;
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .role-gate h2 {
          margin: 8px 0 18px;
          color: #fff;
          font-size: 26px;
          letter-spacing: 0;
          border: 0;
          padding: 0;
        }

        .role-gate div {
          display: grid;
          gap: 10px;
        }

        .master-login-form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          margin-bottom: 10px;
        }

        .master-login-form input {
          min-width: 0;
          border: 1px solid #333;
          border-radius: 6px;
          background: #0b0b0b;
          color: #f4f4f4;
          padding: 0 12px;
          font: inherit;
        }

        .role-gate button {
          border: 1px solid #773030;
          background: #171717;
          color: #f4f4f4;
          border-radius: 6px;
          padding: 14px;
          cursor: pointer;
          font: inherit;
          font-size: 16px;
        }

        .role-gate button:first-child {
          border-color: #36d675;
        }

        .roll-sidebar header {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .roll-sidebar header div {
          display: grid;
          gap: 4px;
          padding: 10px;
          border-right: 1px solid #292929;
        }

        .roll-sidebar header div:last-child {
          border-right: none;
        }

        .roll-sidebar header strong {
          color: #36d675;
          font-size: 19px;
        }

        .roll-card {
          border: 1px solid #303030;
          border-radius: 8px;
          background: #151515;
          padding: 10px;
        }

        .roll-meta,
        .roll-card footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }

        .roll-meta strong {
          font-size: 14px;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .roll-meta time,
        .roll-pool,
        .roll-card footer span {
          color: #aaa;
          font-size: 12px;
        }

        .roll-pool {
          display: block;
          margin-top: 4px;
          line-height: 1.35;
        }

        .dice-row {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin: 10px 0;
        }

        .die {
          width: 31px;
          height: 31px;
          border-radius: 6px;
          border: 1px solid #555;
          display: inline-grid;
          place-items: center;
          font-weight: 700;
          font-size: 14px;
          background: #090909;
          color: #f3f3f3;
        }

        .die-success,
        .die-critical {
          color: #101810;
          background: #36d675;
          border-color: #6df0a0;
          box-shadow: 0 0 12px rgba(54, 214, 117, 0.2);
        }

        .die-critical {
          outline: 2px solid #f2ff7a;
        }

        .die-botch {
          border-color: #f3f3f3;
          color: #fff;
        }

        .roll-card footer strong {
          color: #36d675;
          font-size: 18px;
        }

        .chat-sidebar {
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr) auto;
        }

        .chat-sidebar header {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
        }

        .chat-sidebar header div {
          display: grid;
          gap: 4px;
          padding: 10px;
          border-right: 1px solid #292929;
          min-width: 0;
        }

        .chat-sidebar header div:last-child {
          border-right: none;
        }

        .chat-sidebar header strong {
          color: #36d675;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 14px;
        }

        .chat-login {
          border-bottom: 1px solid #292929;
          background: #121212;
          padding: 10px;
          display: grid;
          gap: 8px;
        }

        .chat-login form,
        .chat-login label {
          display: grid;
          gap: 8px;
        }

        .chat-login label span {
          color: #9c9c9c;
          font-size: 12px;
        }

        .chat-login input,
        .chat-login select,
        .chat-composer textarea {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border: 1px solid #333;
          border-radius: 5px;
          background: #090909;
          color: #eee;
          padding: 8px;
          font: inherit;
          font-size: 12px;
        }

        .chat-login select {
          height: 34px;
        }

        .chat-login button,
        .chat-composer button {
          min-width: 0;
          height: 32px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #1d1d1d;
          color: #f4f4f4;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .chat-login button:disabled,
        .chat-composer button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .chat-auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .chat-auth-tabs button.active {
          border-color: #36d675;
          color: #dfffe9;
          background: #17221a;
        }

        .chat-user-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 70px;
          gap: 8px;
          align-items: center;
        }

        .chat-user-row span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #f2f2f2;
          font-size: 13px;
        }

        .chat-login p {
          margin: 0;
          color: #9c9c9c;
          font-size: 12px;
          line-height: 1.35;
        }

        .room-participants-panel {
          display: grid;
          gap: 7px;
          border: 1px solid #292929;
          border-radius: 7px;
          background: #0b0b0b;
          padding: 8px;
        }

        .room-participants-panel header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 0;
          background: transparent;
          padding: 0;
        }

        .room-participants-panel header strong {
          color: #f4f4f4;
          font-size: 12px;
        }

        .room-participants-panel header span {
          color: #9c9c9c;
          font-size: 11px;
        }

        .room-participants-panel > div {
          display: grid;
          gap: 6px;
          max-height: 168px;
          overflow-y: auto;
        }

        .participant-row {
          width: 100%;
          height: auto !important;
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          text-align: left;
          padding: 7px !important;
        }

        .participant-row > span:last-child {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .participant-row strong,
        .participant-row small {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .participant-row strong {
          color: #f2f2f2;
          font-size: 12px;
        }

        .participant-row small {
          color: #9c9c9c;
          font-size: 11px;
        }

        .voice-panel {
          border-bottom: 1px solid #292929;
          background: #0f0f0f;
          display: grid;
          gap: 9px;
          padding: 10px;
        }

        .voice-panel header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 76px;
          gap: 8px;
          align-items: center;
          border: 0;
          background: transparent;
        }

        .voice-panel header div {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .voice-panel header strong,
        .voice-participant strong,
        .voice-controls strong {
          min-width: 0;
          color: #f3f3f3;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .voice-panel header span,
        .voice-participant span,
        .voice-controls span,
        .voice-participants p {
          color: #9c9c9c;
          font-size: 11px;
        }

        .voice-panel button {
          min-width: 0;
          height: 30px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #1d1d1d;
          color: #f4f4f4;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .voice-panel button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .voice-panel button.danger,
        .voice-panel button.muted {
          border-color: #703333;
          color: #ffd0d0;
          background: #271414;
        }

        .voice-controls {
          display: grid;
          grid-template-columns: 112px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
        }

        .voice-controls label,
        .voice-participant label {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(72px, 1fr) 38px;
          gap: 7px;
          align-items: center;
        }

        .voice-controls .voice-quality {
          grid-column: 1 / -1;
          grid-template-columns: auto minmax(0, 1fr);
        }

        .voice-controls input,
        .voice-participant input {
          min-width: 0;
          width: 100%;
          accent-color: #36d675;
        }

        .voice-controls select {
          min-width: 0;
          width: 100%;
          height: 30px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #090909;
          color: #eee;
          padding: 0 8px;
          font: inherit;
          font-size: 12px;
        }

        .voice-controls select:disabled {
          opacity: 0.6;
        }

        .voice-participants {
          display: grid;
          gap: 7px;
        }

        .voice-participants p {
          margin: 0;
        }

        .voice-participant {
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr);
          gap: 9px;
          align-items: center;
          border: 1px solid #292929;
          border-radius: 7px;
          background: #151515;
          padding: 7px;
        }

        .voice-participant.self {
          border-color: rgba(54, 214, 117, 0.34);
          background: #122018;
        }

        .voice-participant-main,
        .voice-participant-main > div,
        .voice-participant.self > div {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .voice-participant audio {
          display: none;
        }

        .chat-list {
          gap: 8px;
          padding: 10px;
        }

        .chat-message {
          border: 1px solid #303030;
          border-radius: 8px;
          background: #151515;
          padding: 10px;
        }

        .chat-message.own {
          border-color: rgba(54, 214, 117, 0.42);
          background: #142019;
        }

        .chat-message-head {
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
        }

        .chat-avatar {
          width: 38px;
          height: 38px;
          border: 1px solid #343434;
          border-radius: 6px;
          background: #202020;
          overflow: hidden;
          display: grid;
          place-items: center;
          color: #d7d7d7;
          font-size: 16px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .chat-avatar.large {
          width: 52px;
          height: 52px;
          font-size: 20px;
        }

        .chat-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .chat-message-meta {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .diary-sidebar,
        .master-sidebar {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          overflow: hidden;
        }

        .diary-sidebar > header,
        .master-sidebar > header,
        .character-preview-modal header {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          border-bottom: 1px solid #2b2b2b;
          background: #111;
          padding: 10px;
        }

        .diary-sidebar header span,
        .master-sidebar header span,
        .character-preview-modal header span,
        .character-preview-modal small {
          color: #9c9c9c;
          font-size: 12px;
        }

        .diary-sidebar header strong,
        .master-sidebar header strong,
        .character-preview-modal header strong {
          color: #f4f4f4;
          font-size: 13px;
        }

        .diary-layout {
          min-height: 0;
          display: grid;
          grid-template-columns: 145px minmax(0, 1fr);
          overflow: hidden;
        }

        .diary-list {
          min-height: 0;
          border-right: 1px solid #292929;
          background: #111;
          padding: 8px;
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          gap: 8px;
        }

        .diary-list input,
        .diary-editor input,
        .diary-editor textarea {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border: 1px solid #333;
          border-radius: 5px;
          background: #090909;
          color: #eee;
          padding: 8px;
          font: inherit;
          font-size: 12px;
        }

        .diary-list button,
        .diary-editor button,
        .character-preview-actions button,
        .character-preview-actions a {
          min-width: 0;
          border: 1px solid #333;
          border-radius: 5px;
          background: #1d1d1d;
          color: #f4f4f4;
          padding: 8px 10px;
          font: inherit;
          font-size: 12px;
          text-decoration: none;
          cursor: pointer;
        }

        .diary-list > div {
          min-height: 0;
          overflow-y: auto;
          display: grid;
          align-content: start;
          gap: 6px;
        }

        .diary-list > div button {
          display: grid;
          gap: 3px;
          text-align: left;
        }

        .diary-list > div button.active {
          border-color: #773030;
          background: #241414;
        }

        .diary-list strong,
        .diary-list span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .diary-list span {
          color: #9c9c9c;
          font-size: 10px;
        }

        .diary-editor {
          min-height: 0;
          padding: 10px;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          gap: 8px;
        }

        .diary-editor textarea {
          resize: none;
          line-height: 1.45;
        }

        .diary-editor footer,
        .character-preview-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          align-items: center;
          flex-wrap: wrap;
        }

        .diary-editor footer span {
          margin-right: auto;
          color: #9c9c9c;
          font-size: 11px;
        }

        .diary-editor .danger {
          border-color: #703333;
          color: #ffd0d0;
        }

        .master-sidebar {
          grid-template-rows: auto minmax(150px, 0.9fr) minmax(0, 1.1fr);
        }

        .master-reveal-list,
        .master-chat-panel {
          min-height: 0;
          overflow-y: auto;
          display: grid;
          align-content: start;
          gap: 8px;
          padding: 10px;
          border-bottom: 1px solid #292929;
        }

        .master-reveal-list > strong {
          color: #ffb3b3;
          font-size: 13px;
        }

        .master-reveal-list article,
        .master-chat-list article {
          border: 1px solid #303030;
          border-radius: 8px;
          background: #151515;
          padding: 10px;
          display: grid;
          gap: 5px;
        }

        .master-reveal-list article span,
        .master-reveal-list article small,
        .master-reveal-list article time,
        .master-chat-list time {
          color: #9c9c9c;
          font-size: 11px;
        }

        .master-reveal-list article strong,
        .master-chat-list article strong {
          color: #f4f4f4;
          font-size: 13px;
        }

        .master-reveal-list article p,
        .master-chat-list article p {
          margin: 0;
          color: #ddd;
          font-size: 12px;
          line-height: 1.45;
          white-space: pre-wrap;
        }

        .master-chat-panel {
          border-bottom: 0;
          grid-template-rows: auto minmax(0, 1fr) auto;
        }

        .master-chat-panel label {
          display: grid;
          gap: 5px;
          color: #9c9c9c;
          font-size: 12px;
        }

        .master-chat-panel select,
        .master-chat-composer textarea {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border: 1px solid #333;
          border-radius: 5px;
          background: #090909;
          color: #eee;
          padding: 8px;
          font: inherit;
          font-size: 12px;
        }

        .master-chat-list {
          min-height: 0;
          overflow-y: auto;
          display: grid;
          align-content: start;
          gap: 8px;
        }

        .master-chat-list article.own {
          border-color: rgba(54, 214, 117, 0.42);
          background: #142019;
        }

        .master-chat-composer {
          display: grid;
          gap: 8px;
        }

        .master-chat-composer textarea {
          resize: vertical;
        }

        .master-chat-composer button {
          min-height: 32px;
          border: 1px solid #333;
          border-radius: 5px;
          background: #1d1d1d;
          color: #f4f4f4;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .master-chat-composer button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .chat-message-meta strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 14px;
          color: #f4f4f4;
        }

        .chat-message-meta time,
        .chat-message > span {
          color: #8e8e8e;
          font-size: 11px;
        }

        .chat-message p {
          margin: 7px 0 6px;
          color: #e9e9e9;
          font-size: 13px;
          line-height: 1.42;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .chat-composer {
          display: grid;
          gap: 8px;
          padding: 10px;
          border-top: 1px solid #292929;
          background: #101010;
        }

        .chat-composer textarea {
          min-height: 72px;
          resize: vertical;
          line-height: 1.35;
        }

        @media (max-width: 1040px) {
          html,
          body {
            overflow: auto !important;
          }

          .table-page-shell {
            padding: 14px 10px;
          }

          .table-layout {
            grid-template-columns: 1fr;
            height: auto;
            min-height: 0;
          }

          .play-surface {
            height: min(68svh, 680px);
            min-height: 420px;
          }

          .right-rail {
            grid-template-rows: auto minmax(420px, 52svh);
          }

          .table-topbar {
            display: grid;
          }
        }

        @media (max-width: 720px) {
          .table-page-shell {
            padding: 8px;
          }

          .table-topbar {
            gap: 10px;
            margin-bottom: 8px;
          }

          h1 {
            font-size: 24px;
          }

          .table-kicker {
            font-size: 10px;
            margin-bottom: 3px;
          }

          .table-actions {
            width: 100%;
            overflow-x: auto;
            padding-bottom: 2px;
          }

          .table-actions a,
          .table-actions button {
            flex: 0 0 auto;
            padding: 8px 10px;
            font-size: 12px;
          }

          .master-password-control {
            min-width: 260px;
          }

          .table-layout {
            gap: 8px;
          }

          .play-surface {
            height: 58svh;
            min-height: 340px;
          }

          .surface-head {
            grid-template-columns: 1fr auto;
            display: grid;
            padding: 8px;
          }

          .surface-head div:nth-child(2) {
            display: none;
          }

          .zoom-tools button {
            width: 38px;
            height: 34px;
          }

          .right-rail {
            grid-template-rows: auto minmax(360px, 42svh);
            gap: 8px;
          }

          .right-tabs button,
          .sub-tabs button {
            height: 38px;
            font-size: 12px;
          }

          .layer-row {
            min-height: 76px;
          }

          .layer-name {
            min-height: 76px;
            grid-template-columns: 64px minmax(0, 1fr) 24px auto;
            gap: 9px;
            padding: 6px;
          }

          .layer-thumb {
            width: 64px !important;
            height: 54px !important;
            min-width: 64px !important;
            min-height: 54px !important;
            max-width: 64px !important;
            max-height: 54px !important;
          }

          .layer-title span {
            font-size: 17px;
          }

          .folder-toggle {
            width: 24px;
            height: 40px;
            font-size: 26px;
          }

          .layer-quick-actions {
            gap: 5px;
          }

          .layer-quick-actions button {
            width: 28px;
            height: 28px;
          }

          .media-preview-backdrop {
            padding: 8px;
          }

          .media-preview-modal {
            height: 88svh;
          }

          .image-editor-backdrop {
            padding: 8px;
          }

          .image-editor-modal {
            height: 92svh;
          }

          .image-editor-modal header {
            display: grid;
          }

          .image-editor-body {
            grid-template-columns: 1fr;
            grid-template-rows: minmax(0, 1fr) auto;
          }

          .image-editor-tools {
            border-left: 0;
            border-top: 1px solid #2b2b2b;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .editor-slider {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </>
  )
}

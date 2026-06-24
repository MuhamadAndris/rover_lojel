'use client';

import { AgGridReact, AgGridReactProps } from 'ag-grid-react';
import { themeQuartz, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

// Register all community features once per app load (required since v32+
// split AG Grid into modular packages). Safe to call multiple times.
ModuleRegistry.registerModules([AllCommunityModule]);

// Custom theme matching the app's brand colors (Theming API, AG Grid v32+).
// NOTE: with the Theming API, do NOT also import the legacy
// 'ag-grid-community/styles/ag-grid.css' — they conflict.
export const appGridTheme = themeQuartz.withParams({
  accentColor: '#1C7C71',
  headerBackgroundColor: '#F5F6F8',
  headerTextColor: '#5B6478',
  headerFontSize: 12,
  headerFontWeight: 600,
  fontSize: 13,
  fontFamily: 'var(--font-inter), system-ui, sans-serif',
  borderColor: '#E6E9EF',
  rowHoverColor: '#F1FAF7',
  oddRowBackgroundColor: '#FBFCFD',
  wrapperBorderRadius: 14,
  cellHorizontalPadding: 14,
  rowHeight: 40,
  headerHeight: 38,
});

interface DataGridProps extends AgGridReactProps {
  height?: number | string;
}

export default function DataGrid({ height = 520, ...props }: DataGridProps) {
  return (
    <div style={{ height, width: '100%' }}>
      <AgGridReact
        theme={appGridTheme}
        animateRows
        suppressCellFocus
        defaultColDef={{
          resizable: true,
          sortable: true,
          ...props.defaultColDef,
        }}
        {...props}
      />
    </div>
  );
}

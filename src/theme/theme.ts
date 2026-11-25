import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1D4ED8', // Dark Blue to Light Blue Theme
      light: '#F0F9FF',
      dark: '#172554',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#0F172A', // Slate Obsidian
      light: '#334155',
      dark: '#020617',
      contrastText: '#FFFFFF',
    },
    text: {
      primary: '#0F172A',
      secondary: '#475569',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    divider: '#E2E8F0',
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontSize: '28px',
      fontWeight: 800,
      color: '#0F172A',
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '22px',
      fontWeight: 700,
      color: '#0F172A',
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '18px',
      fontWeight: 700,
      color: '#0F172A',
      letterSpacing: '-0.01em',
    },
    subtitle1: {
      fontSize: '14.5px',
      fontWeight: 600,
      color: '#1E293B',
    },
    body1: {
      fontSize: '14px',
      fontWeight: 500,
      color: '#1E293B',
    },
    body2: {
      fontSize: '13px',
      fontWeight: 500,
      color: '#64748B',
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
          borderRadius: '7px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          backgroundColor: '#1D4ED8',
          color: '#FFFFFF',
          boxShadow: 'none',
          '&:hover': {
            backgroundColor: '#1E40AF',
            boxShadow: 'none',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          fontSize: '11.5px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#1E293B',
          '@media (max-width: 600px)': {
            padding: '8px 10px',
            fontSize: '11px',
          },
        },
        body: {
          fontSize: '13.5px',
          fontWeight: 500,
          color: '#334155',
          '@media (max-width: 600px)': {
            padding: '8px 10px',
            fontSize: '12.5px',
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          maxWidth: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          margin: 16,
          '@media (max-width: 600px)': {
            margin: 8,
            width: 'calc(100% - 16px) !important',
            maxHeight: 'calc(100% - 16px) !important',
          },
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          flexWrap: 'wrap',
          gap: '8px',
        },
      },
    },
  },
});

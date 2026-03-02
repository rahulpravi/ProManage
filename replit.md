# ProManage - Production Management App

## Overview
A comprehensive production management mobile app built with Expo React Native. Fully offline/local - all data stored on device via AsyncStorage. No server required for core functionality.

## Features
- **Dashboard**: Bar chart with weekly/monthly filter, machine-wise stats for 5 machines
- **Stock Page**: Add parts, auto-deduct on material request, stock level indicators
- **Production Page**: Material Request (auto-deducts stock) + Production Complete with serial numbers
- **QC Page**: QC check with auto-formatted serial numbers (e.g., 5051-R for Rahul), pending/passed views
- **Sales Page**: Ready-for-sale items from QC, Mark as Sold, sold history
- **CSV Export**: Every page has share button to export data as CSV (WhatsApp shareable)

## Architecture
- **Frontend**: Expo Router (file-based routing), 5-tab navigation with liquid glass support
- **Storage**: AsyncStorage (fully local, no server needed)
- **State**: React Context (AppContext) for shared app state
- **Theme**: Dark navy (#0F172A) with professional blue (#1B4FD8) - HRM-style

## Machines (5)
- Shord, Sord, OBC, 4 Way, 48 Way

## Key Files
- `lib/database.ts` - All AsyncStorage CRUD operations
- `lib/exportCsv.ts` - CSV export + file sharing
- `context/AppContext.tsx` - Global state provider
- `constants/colors.ts` - Theme colors
- `app/(tabs)/` - 5 tab screens

## Workflows
- **Start Frontend**: `npm run expo:dev` - Expo dev server on port 8081
- **Start Backend**: `npm run server:dev` - Express server on port 5000 (landing page only)

## Tech Stack
- Expo SDK 54, Expo Router, React Native
- AsyncStorage for local data
- react-native-svg for charts
- expo-sharing + expo-file-system for CSV export
- @expo-google-fonts/inter for typography

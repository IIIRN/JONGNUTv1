
# Project Blueprint: Beauty Service Booking Application

## 1. Overview

This document outlines the plan for transforming the existing "car booking" application into a "beauty service" booking platform. The goal is to create a visually appealing and intuitive application for users to book beauty appointments.

## 2. Current State

The application is currently a car booking platform with the following features:

*   User roles: admin, customer, driver, employee
*   Admin panel for managing bookings, drivers, and vehicles
*   Customer-facing interface for booking vehicles
*   Driver-facing interface for managing their schedule

## 3. Proposed Changes

The following changes will be made to transform the application into a beauty service booking platform:

### 3.1. Terminology and Branding

*   Replace all instances of "car", "vehicle", "driver", and "booking" with "service", "appointment", "beautician", and "appointment" respectively.
*   Update the color scheme, fonts, and iconography to reflect a beauty and wellness theme.

### 3.2. File and Directory Renaming

*   `src/app/(admin)/vehicles` -> `src/app/(admin)/services`
*   `src/app/(admin)/drivers` -> `src/app/(admin)/beauticians`
*   `src/app/(customer)/booking` -> `src/app/(customer)/appointment`
*   `src/app/(customer)/my-bookings` -> `src/app/(customer)/my-appointments`
*   `src/app/(drivers)` -> `src/app/(beauticians)`
*   `src/app/actions/vehicleActions.js` -> `src/app/actions/serviceActions.js`
*   `src/app/actions/driverActions.js` -> `src/app/actions/beauticianActions.js`
*   `src/app/actions/bookingActions.js` -> `src/app/actions/appointmentActions.js`

### 3.3. Content and UI Updates

*   **Home Page (`src/app/page.js`):**
    *   Replace car-related images and text with high-quality images of beauty services (e.g., facials, massages, manicures).
    *   Update the marketing copy to promote beauty services.
*   **Admin Panel:**
    *   Update the admin dashboard to display statistics related to appointments and services.
    *   Modify the forms for adding and editing services and beauticians.
*   **Customer Flow:**
    *   Redesign the appointment booking process to be more visually appealing and user-friendly.
    *   Update the "My Appointments" page to display a history of past and upcoming appointments.
*   **Beautician Flow:**
    *   Create a new interface for beauticians to manage their schedules and view upcoming appointments.

### 3.4. Database Schema (Assumed)

*   The underlying database schema will need to be updated to reflect the new data model (e.g., `services` table instead of `vehicles` table). This is outside the scope of the file-based changes but is a necessary step for the application to function correctly.

## 4. Action Plan

1.  **Rename files and directories:** Start by renaming the files and directories as outlined in section 3.2.
2.  **Update server actions:** Modify the server actions to work with the new data model.
3.  **Update UI components:** Update the UI components to reflect the new theme and terminology.
4.  **Update pages:** Update the content of the pages to match the new theme.
5.  **Test the application:** Thoroughly test the application to ensure that all features are working as expected.

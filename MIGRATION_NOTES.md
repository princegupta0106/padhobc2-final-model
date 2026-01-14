# Database Migration: Colleges Collection

## Overview
The database has been restructured to use a `colleges` collection that embeds courses as an array instead of having a separate `courses` collection. This provides **faster search** and **better performance** by eliminating the need for separate queries.

## What Changed?

### Before (Separate Collections)
- `courses` collection: One document per course
- Query: `db.collection('courses').where('collegeId', '==', userCollegeId)`
- Problem: Requires a full collection scan with filtering

### After (Embedded Courses)
- `colleges` collection: One document per college containing courses array
- Query: `db.collection('colleges').where('collegeId', '==', userCollegeId)`
- Benefit: Single document fetch with all courses embedded

## Collection Structure

### colleges
```javascript
{
  collegeId: "BITS_PILANI",
  name: "BITS Pilani",
  extensionUrl: "https://www.bits-pilani.ac.cn",
  logo: "",
  courses: [
    {
      code: "BITS F464",
      name: "MACHINE LEARNING",
      semester: "I-Semester 2025-26",
      progress: 0
    },
    // ... more courses
  ],
  createdAt: "2024-01-01T00:00:00.000Z"
}
```

## Updated Files

### 1. Seed.jsx
- **Added**: `seedColleges()` function to populate colleges collection
- **Modified**: `seedAll()` now seeds colleges instead of individual courses
- **Modified**: `seedResources()` now uses `courseCode` instead of `courseId`
- **UI Changes**: 
  - "Seed Courses" button → "Seed Colleges" button
  - "Clear Courses" button → "Clear Colleges" button

### 2. Home.jsx
- **Modified**: `fetchCourses()` now queries the `colleges` collection
- **Change**: Fetches college document by `collegeId` and extracts embedded `courses` array
- **Course IDs**: Now use composite format: `{collegeId}_{courseCode}` (e.g., `BITS_PILANI_BITS F464`)

### 3. CoursePage.jsx
- **Modified**: `fetchCourseData()` now extracts course code from composite ID
- **Change**: Queries `colleges` collection to get course details from embedded array
- **Resources Query**: Changed from `where('courseId', '==', courseId)` to `where('courseCode', '==', courseCode)`

### 4. UploadResource.jsx
- **Modified**: `handleUpload()` extracts course code from composite ID
- **Change**: Storage path now uses course code: `courses/{courseCode}/{folderName}/{fileName}`
- **Firestore**: Resources now store `courseCode` field instead of `courseId`
- **Modified**: `canUploadToCourse()` checks admin permissions using course code

### 5. SuperAdmin.jsx
- **Modified**: `fetchData()` fetches all colleges and extracts courses from embedded arrays
- **Change**: Builds course list from all colleges with composite IDs
- **Admin Courses**: Now stores course codes (e.g., `"BITS F464"`) instead of document IDs
- **UI**: Course selection checkboxes now work with course codes

### 6. DATABASE_STRUCTURE.md
- **Updated**: Documented new `colleges` collection structure
- **Marked**: `courses` collection as deprecated
- **Updated**: `resources` collection now uses `courseCode` field
- **Updated**: Firebase security rules for colleges collection
- **Updated**: Storage rules to use course codes

## Migration Steps

### For New Installations
1. Use the Seed Data page
2. Click "Seed Colleges" button
3. Click "Seed Resources" button
4. Click "Seed Leaderboard" button

### For Existing Installations
1. **Backup your data** from Firebase Console
2. Export existing courses from the `courses` collection
3. Group courses by `collegeId`
4. Create college documents with embedded courses arrays
5. Update existing resources to use `courseCode` instead of `courseId`
6. Update user `enrolledCourses` and `adminCourses` arrays if needed

## Benefits

### 🚀 Performance
- **Single Query**: Fetch one college document instead of filtering all courses
- **Embedded Data**: No additional queries needed to get course list
- **Faster Search**: All courses for a college are in memory after one fetch

### 🔍 Search Optimization
- Client-side filtering on embedded courses array
- No Firestore queries for search - just array filtering
- Instant search results

### 💰 Cost Savings
- Fewer Firestore reads (1 read per college vs N reads for N courses)
- Reduced network overhead
- Lower Firebase billing costs

## Course ID Format

### Composite ID Structure
- Format: `{collegeId}_{courseCode}`
- Example: `BITS_PILANI_CS F407`
- Example: `BITS_PILANI_BITS F464`

### Why Composite IDs?
- Ensures global uniqueness across colleges
- Allows same course code in different colleges
- Easy to extract both college and course information
- Works seamlessly with React Router params

## Admin Permissions

### Before
- `adminCourses`: `["documentId1", "documentId2"]`
- Problem: Document IDs change if courses are re-created

### After
- `adminCourses`: `["CS F407", "BITS F464"]`
- Benefit: Course codes are stable and human-readable
- Benefit: Works across database migrations

## Important Notes

1. **Backward Compatibility**: The old `courses` collection can remain for backward compatibility but is not actively used
2. **Enrolled Courses**: User `enrolledCourses` should use composite IDs (`BITS_PILANI_CS F407`) for consistency
3. **Resources**: All resources now reference `courseCode` instead of `courseId`
4. **Search**: Filtering happens client-side on the courses array, not in Firestore queries

## Testing Checklist

- [ ] Seed colleges collection successfully
- [ ] Home page displays courses correctly
- [ ] Course detail page loads with proper course info
- [ ] Resources display correctly on course page
- [ ] Upload functionality works with course codes
- [ ] Admin permissions check course codes correctly
- [ ] Super Admin can assign courses to admins
- [ ] Search filters courses properly
- [ ] Enroll/unenroll updates user's enrolled courses

## Rollback Plan

If issues occur:
1. Keep the old `courses` collection as backup
2. Revert code changes in the affected files
3. Switch back to querying `courses` collection
4. Update resources to use `courseId` again

## Future Enhancements

1. Add college search functionality
2. Support multiple colleges per user
3. Add college-specific settings (theme, logo, etc.)
4. Implement cross-college course sharing
5. Add college admin role (can manage all courses for a college)

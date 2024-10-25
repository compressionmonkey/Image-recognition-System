// Example of how to log analytics to Google Sheet
// keep ready for future use
import { google } from 'googleapis';
// Load your credentials from the JSON key file or use environment variables
const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'hackthon-315919-98de76b84102.json'), // Replace with the path to your JSON key
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly'
    ],
  });

async function logAnalytics(data) {
    async function testSheetsConnection() {
        const authClient = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });
        const drive = google.drive({ version: 'v3', auth: authClient });
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

        try {
          // Get spreadsheet properties
          const spreadsheetResponse = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
            fields: 'properties.title,sheets.properties.title',
          });

          console.log('Spreadsheet Title:', spreadsheetResponse.data.properties.title);
          console.log('Sheets in this spreadsheet:');
          spreadsheetResponse.data.sheets.forEach((sheet, index) => {
            console.log(`  ${index + 1}. ${sheet.properties.title}`);
          });

          // Get file metadata from Drive API
          const fileMetadata = await drive.files.get({
            fileId: spreadsheetId,
            fields: 'name, parents',
          });

          console.log('File name:', fileMetadata.data.name);

          // Get parent folder name
          if (fileMetadata.data.parents && fileMetadata.data.parents.length > 0) {
            const parentFolderId = fileMetadata.data.parents[0];
            const parentFolder = await drive.files.get({
              fileId: parentFolderId,
              fields: 'name',
            });
            console.log('Parent folder:', parentFolder.data.name);
          } else {
            console.log('This file is not in any folder (root of My Drive)');
          }

          // Get some data from the first sheet
          const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: 'Sheet1!B6:D10', // Adjust this range as needed
          });

          console.log('Data from Sheet1:');
          console.log(dataResponse.data.values);

        } catch (err) {
          console.error('Error testing connection:', err);
        }
      }
      
      // Call this function to test the connection
      testSheetsConnection();
// const authClient = await auth.getClient();
//   const timestamp = Math.floor(Date.now() / 1000).toString();
//   const logEntry = {
//     timestamp,
//     ...data
//   };
  
//   console.log('Analytics Log:', JSON.stringify(logEntry, null, 2));
//   const sheetName = 'AnalyticsLog';
//   const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
//   const rangeName = `${sheetName}!A:E`; // Changed from `${sheetName}!A1` to `${sheetName}!A:E`

//   const sheets = google.sheets({ version: 'v4', auth: authClient });
//   const resource = {
//     values: [[
//       logEntry.timestamp,
//       logEntry.processingTime,
//       logEntry.deviceInfo,
//       logEntry.imageSizeMb,
//       logEntry.success
//     ]]
//   };

//   try {
//     const result = await sheets.spreadsheets.values.append({
//       spreadsheetId,
//       range: rangeName,
//       valueInputOption: 'USER_ENTERED',
//       insertDataOption: 'INSERT_ROWS',
//       resource,
//     });
//     console.log('Analytics uploaded to Google Sheet successfully.');
//   } catch (err) {
//     console.error('Error uploading analytics to Google Sheet:', err.message);
//   }
}

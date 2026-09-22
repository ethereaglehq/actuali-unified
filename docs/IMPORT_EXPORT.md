# Import and export

Actuali supports two complementary ways to move budget data:

- **Full budget backup:** Settings → Export data creates the standard Actual zip backup. Restore it from the budget chooser when you need a complete recovery.
- **Selective transfer:** Settings → Selective import and export creates a portable JSON file containing only the sections you choose: payees, rules, tags, schedules, and saved reports.

Selective export is useful when sharing a setup between budgets. Choose one or more sections, select **Export selected**, and save the generated JSON file. The file includes a format version so incompatible files can be rejected clearly instead of being treated as a partial import.

To import, choose a JSON transfer file. Actuali checks the file size and format, asks the server to preview the selected sections, and shows section counts, items ready to add, skips, and warnings. Selecting **Import reviewed sections** is the explicit confirmation that applies the reviewed sections. Choosing a file alone never writes to the budget. Existing IDs and invalid entries are reported as skipped by the transfer handler; they are not silently overwritten.

Reports also retain their existing report-toolbar actions for CSV/image exports and dashboard configuration import. Use selective transfer for saved report definitions supported by the current database version.

Sync remains the right choice for day-to-day changes across devices. Use full backups for recovery and selective transfers for reusable configuration.

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "class-breakpoint" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('class-breakpoint.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from class-breakpoint!');
	});

	// Register the new breakpoint command
	const newBreakpointDisposable = vscode.commands.registerCommand('class-breakpoint.newBreakpoint', async (uri: vscode.Uri) => {
		// The uri parameter contains the folder that was right-clicked
		const folderPath = uri.fsPath;
		
		// Prompt user for breakpoint name
		const breakpointName = await vscode.window.showInputBox({
			prompt: 'Enter a name for the breakpoint',
			placeHolder: 'Breakpoint name...',
			validateInput: (value: string) => {
				if (!value || value.trim() === '') {
					return 'Breakpoint name cannot be empty';
				}
				return null;
			}
		});
		
		// Check if user cancelled the input
		if (breakpointName === undefined) {
			return; // User cancelled
		}
		
		// Show confirmation with the entered name and folder path
		vscode.window.showInformationMessage(`Created breakpoint "${breakpointName}" in folder: ${folderPath}`);
		
		// Add your breakpoint logic here
		// For example, you might want to create a file, mark a location, etc.
		// You now have access to both breakpointName and folderPath
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(newBreakpointDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

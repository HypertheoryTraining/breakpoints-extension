// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

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
		
		try {
			// Get the workspace root
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder found');
				return;
			}
			
			const workspaceRoot = workspaceFolder.uri.fsPath;
			
			// Check if this is a Git repository and perform Git operations
			if (await isGitRepository(workspaceRoot)) {
				try {
					await performGitOperations(workspaceRoot, breakpointName);
					vscode.window.showInformationMessage(`Created Git branch "${breakpointName}"`);
				} catch (gitError: any) {
					vscode.window.showWarningMessage(`Git operations failed: ${gitError.message}`);
					// Continue with breakpoint creation even if Git fails
				}
			}
			
			const breakpointsDir = path.join(workspaceRoot, 'breakpoints');
			const breakpointDir = path.join(breakpointsDir, breakpointName);
			const targetDir = path.join(breakpointDir, '01-initial');
			
			// Create breakpoints directory if it doesn't exist
			if (!fs.existsSync(breakpointsDir)) {
				fs.mkdirSync(breakpointsDir, { recursive: true });
			}
			
			// Check if breakpoint directory already exists
			if (fs.existsSync(breakpointDir)) {
				const overwrite = await vscode.window.showWarningMessage(
					`Breakpoint "${breakpointName}" already exists. Overwrite?`,
					'Yes', 'No'
				);
				if (overwrite !== 'Yes') {
					return;
				}
				// Remove existing directory
				fs.rmSync(breakpointDir, { recursive: true, force: true });
			}
			
			// Copy the folder content
			await copyFolder(folderPath, targetDir);
			
			// If in Git repository, add and commit the breakpoint files
			if (await isGitRepository(workspaceRoot)) {
				try {
					await executeGitCommand('git add .', workspaceRoot);
					await executeGitCommand('git commit -m "created breakpoint"', workspaceRoot);
				} catch (gitError: any) {
					vscode.window.showWarningMessage(`Failed to commit breakpoint: ${gitError.message}`);
				}
			}
			
			// Show success message
			vscode.window.showInformationMessage(`Created breakpoint "${breakpointName}" successfully!`);
			
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to create breakpoint: ${error}`);
		}
	});

	// Register the add step command
	const addStepDisposable = vscode.commands.registerCommand('class-breakpoint.addStep', async (uri: vscode.Uri) => {
		// The uri parameter contains the folder that was right-clicked
		const folderPath = uri.fsPath;
		
		try {
			// Get the workspace root
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder found');
				return;
			}
			
			const workspaceRoot = workspaceFolder.uri.fsPath;
			const breakpointsDir = path.join(workspaceRoot, 'breakpoints');
			
			// Check if breakpoints directory exists
			if (!fs.existsSync(breakpointsDir)) {
				vscode.window.showErrorMessage('No breakpoints folder found. Create a breakpoint first.');
				return;
			}
			
			// Find all breakpoint directories
			const breakpointDirs = fs.readdirSync(breakpointsDir)
				.filter(item => fs.statSync(path.join(breakpointsDir, item)).isDirectory());
			
			if (breakpointDirs.length === 0) {
				vscode.window.showErrorMessage('No breakpoints found. Create a breakpoint first.');
				return;
			}
			
			// Let user select which breakpoint to add step to
			let selectedBreakpoint: string;
			if (breakpointDirs.length === 1) {
				selectedBreakpoint = breakpointDirs[0];
			} else {
				const selection = await vscode.window.showQuickPick(breakpointDirs, {
					placeHolder: 'Select a breakpoint to add step to'
				});
				if (!selection) {
					return; // User cancelled
				}
				selectedBreakpoint = selection;
			}
			
			const breakpointDir = path.join(breakpointsDir, selectedBreakpoint);
			
			// Find the next step number by looking at existing folders
			const existingSteps = fs.readdirSync(breakpointDir)
				.filter(item => fs.statSync(path.join(breakpointDir, item)).isDirectory())
				.filter(item => /^\d{2}-/.test(item)) // Folders starting with two digits and a dash
				.map(item => parseInt(item.substring(0, 2)))
				.sort((a, b) => a - b);
			
			const nextStepNumber = existingSteps.length > 0 ? Math.max(...existingSteps) + 1 : 2;
			const stepNumberStr = nextStepNumber.toString().padStart(2, '0');
			
			// Prompt user for step name
			const stepName = await vscode.window.showInputBox({
				prompt: 'Enter a name for the step',
				placeHolder: 'Step name...',
				validateInput: (value: string) => {
					if (!value || value.trim() === '') {
						return 'Step name cannot be empty';
					}
					return null;
				}
			});
			
			// Check if user cancelled the input
			if (stepName === undefined) {
				return; // User cancelled
			}
			
			const stepFolderName = `${stepNumberStr}-${stepName}`;
			const targetDir = path.join(breakpointDir, stepFolderName);
			
			// Check if step already exists
			if (fs.existsSync(targetDir)) {
				vscode.window.showErrorMessage(`Step "${stepFolderName}" already exists in breakpoint "${selectedBreakpoint}".`);
				return;
			}
			
			// Copy the folder content
			if (await isGitRepository(workspaceRoot)) {
				// In a Git repository - copy only changed files
				await copyChangedFiles(workspaceRoot, targetDir);
			} else {
				// Not in Git repository - copy entire folder as before
				await copyFolder(folderPath, targetDir);
			}
			
			// If in Git repository, commit the step, merge to main, and switch back
			if (await isGitRepository(workspaceRoot)) {
				try {
					// Add and commit the new step
					await executeGitCommand('git add .', workspaceRoot);
					await executeGitCommand(`git commit -m "${stepFolderName}"`, workspaceRoot);
					
					// Switch to main branch
					await executeGitCommand('git checkout main', workspaceRoot);
					
					// Merge the breakpoint branch
					await executeGitCommand(`git merge ${selectedBreakpoint}`, workspaceRoot);
					
					// Switch back to the breakpoint branch
					await executeGitCommand(`git checkout ${selectedBreakpoint}`, workspaceRoot);
					
					vscode.window.showInformationMessage(`Git operations completed: committed "${stepFolderName}", merged to main, and returned to "${selectedBreakpoint}" branch`);
				} catch (gitError: any) {
					vscode.window.showWarningMessage(`Git operations failed: ${gitError.message}`);
				}
			}
			
			// Show success message
			vscode.window.showInformationMessage(`Added step "${stepFolderName}" to breakpoint "${selectedBreakpoint}" successfully!`);
			
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to add step: ${error}`);
		}
	});

	// Register the push main command
	const pushMainDisposable = vscode.commands.registerCommand('class-breakpoint.pushMain', async () => {
		try {
			// Get the workspace root
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				vscode.window.showErrorMessage('No workspace folder found');
				return;
			}
			
			const workspaceRoot = workspaceFolder.uri.fsPath;
			
			// Check if this is a Git repository
			if (!(await isGitRepository(workspaceRoot))) {
				vscode.window.showErrorMessage('Not a Git repository');
				return;
			}
			
			try {
				// Get current branch to switch back to later
				const currentBranch = await executeGitCommand('git branch --show-current', workspaceRoot);
				
				// Switch to main branch
				await executeGitCommand('git checkout main', workspaceRoot);
				
				// Push main branch to origin
				await executeGitCommand('git push origin main', workspaceRoot);
				
				// Switch back to the original branch if it wasn't main
				if (currentBranch !== 'main') {
					await executeGitCommand(`git checkout ${currentBranch}`, workspaceRoot);
					vscode.window.showInformationMessage(`Pushed main to origin and returned to "${currentBranch}" branch`);
				} else {
					vscode.window.showInformationMessage('Pushed main to origin successfully');
				}
				
			} catch (gitError: any) {
				vscode.window.showErrorMessage(`Failed to push main: ${gitError.message}`);
			}
			
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to push main: ${error}`);
		}
	});

	// Helper function to copy folder recursively
	async function copyFolder(source: string, destination: string): Promise<void> {
		// Create destination directory
		fs.mkdirSync(destination, { recursive: true });
		
		// Read source directory
		const items = fs.readdirSync(source);
		
		for (const item of items) {
			const sourcePath = path.join(source, item);
			const destPath = path.join(destination, item);
			const stat = fs.statSync(sourcePath);
			
			if (stat.isDirectory()) {
				// Recursively copy subdirectory
				await copyFolder(sourcePath, destPath);
			} else {
				// Copy file
				fs.copyFileSync(sourcePath, destPath);
			}
		}
	}

	// Helper function to copy only changed files since last commit
	async function copyChangedFiles(workspaceRoot: string, destination: string): Promise<void> {
		try {
			// Get list of changed files since last commit
			const changedFilesOutput = await executeGitCommand('git diff --name-only HEAD', workspaceRoot);
			const stagedFilesOutput = await executeGitCommand('git diff --cached --name-only', workspaceRoot);
			
			// Combine changed and staged files
			const changedFiles = new Set([
				...changedFilesOutput.split('\n').filter(f => f.trim()),
				...stagedFilesOutput.split('\n').filter(f => f.trim())
			]);
			
			if (changedFiles.size === 0) {
				vscode.window.showWarningMessage('No changed files found since last commit. Creating empty step folder.');
				fs.mkdirSync(destination, { recursive: true });
				return;
			}
			
			// Create destination directory
			fs.mkdirSync(destination, { recursive: true });
			
			// Copy each changed file
			for (const relativeFilePath of changedFiles) {
				const sourcePath = path.join(workspaceRoot, relativeFilePath);
				const destPath = path.join(destination, relativeFilePath);
				
				// Check if source file exists (it might have been deleted)
				if (fs.existsSync(sourcePath)) {
					// Create directory structure if needed
					const destDir = path.dirname(destPath);
					fs.mkdirSync(destDir, { recursive: true });
					
					// Copy the file
					fs.copyFileSync(sourcePath, destPath);
				}
			}
			
			vscode.window.showInformationMessage(`Copied ${changedFiles.size} changed file(s) to step folder`);
			
		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to get changed files: ${error.message}`);
			throw error;
		}
	}

	// Helper function to execute git commands
	const execAsync = promisify(exec);
	
	async function executeGitCommand(command: string, cwd: string): Promise<string> {
		try {
			const { stdout } = await execAsync(command, { cwd });
			return stdout.trim();
		} catch (error: any) {
			throw new Error(`Git command failed: ${error.message}`);
		}
	}
	
	async function isGitRepository(workspaceRoot: string): Promise<boolean> {
		try {
			await executeGitCommand('git rev-parse --git-dir', workspaceRoot);
			return true;
		} catch {
			return false;
		}
	}
	
	async function hasUncommittedChanges(workspaceRoot: string): Promise<boolean> {
		try {
			const status = await executeGitCommand('git status --porcelain', workspaceRoot);
			return status.length > 0;
		} catch {
			return false;
		}
	}
	
	async function performGitOperations(workspaceRoot: string, breakpointName: string): Promise<void> {
		// Check if there are uncommitted changes and commit them
		if (await hasUncommittedChanges(workspaceRoot)) {
			await executeGitCommand('git add .', workspaceRoot);
			await executeGitCommand('git commit -m "Auto-commit before creating breakpoint"', workspaceRoot);
		}
		
		// Create and checkout new branch
		await executeGitCommand(`git checkout -b ${breakpointName}`, workspaceRoot);
	}

	context.subscriptions.push(disposable);
	context.subscriptions.push(newBreakpointDisposable);
	context.subscriptions.push(addStepDisposable);
	context.subscriptions.push(pushMainDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

# BreakPoint - Classroom Training Extension

A powerful VS Code extension designed for classroom training and educational purposes. BreakPoint allows instructors to create detailed, step-by-step project snapshots with integrated Git workflow management and automatic documentation generation.

## 🎯 Purpose

This extension is perfect for:
- **Coding instructors** who need to demonstrate step-by-step project development
- **Workshop facilitators** creating hands-on learning experiences
- **Training materials** that require detailed change tracking
- **Educational content** with progressive complexity

## ✨ Features

### 🆕 **New Breakpoint**
- Right-click any folder in the Explorer to create a new breakpoint
- Automatically creates a Git branch for the breakpoint
- Copies the entire folder structure as the initial step (`01-initial`)
- Integrates seamlessly with Git workflow

### ➕ **Add Step**
- Incrementally track changes as you develop your project
- Automatically detects and copies only modified files since the last commit
- Creates numbered step folders (`02-feature`, `03-styling`, etc.)
- Commits changes and merges to main branch automatically

### 🚀 **Push Main**
- Safely pushes your main branch to remote repository
- Automatically switches back to your breakpoint branch
- Handles branch management transparently

### 📋 **Finish Breakpoint**
- Generates comprehensive change logs with detailed documentation
- Shows file listings organized by directory structure
- **Includes actual Git diffs** showing exact code changes with `+` and `-` indicators
- Creates collapsible sections for easy navigation
- Opens the generated `change-log.md` automatically

## 🔧 How to Use

### Getting Started

1. **Open your project** in VS Code (preferably a Git repository)
2. **Right-click any folder** in the Explorer view
3. **Select "BreakPoint: New Breakpoint"**
4. **Enter a name** for your breakpoint (e.g., "react-tutorial")

### Adding Steps

1. **Make changes** to your project code
2. **Open Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. **Run "BreakPoint: Add Step"**
4. **Enter a step name** (e.g., "add-components")

### Finishing and Documentation

1. **Open Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. **Run "BreakPoint: Finish Breakpoint"**
3. **Review the generated change log** with complete Git diffs

### Sharing Your Work

1. **Use "BreakPoint: Push Main"** to sync your main branch
2. **Share the `breakpoints/` folder** with students
3. **Students can follow along** using the detailed change logs

## 📁 Project Structure

After using BreakPoint, your project will have this structure:

```
your-project/
├── src/                          # Your main project files
├── package.json
└── breakpoints/
    └── your-breakpoint-name/
        ├── 01-initial/           # Initial project state
        ├── 02-add-components/    # Changed files for step 2
        ├── 03-styling/           # Changed files for step 3
        └── change-log.md         # Generated documentation
```

## 🎓 Generated Documentation

The change log includes:
- **Step-by-step file listings** organized by directory
- **Git diffs** showing exactly what code changed
- **Collapsible sections** for easy navigation
- **Summary statistics** (total steps, file counts)
- **Professional formatting** ready for educational use

## 📋 Requirements

- **VS Code** 1.102.0 or higher
- **Git** repository (recommended for full functionality)
- **Node.js** project structure (works with any language)

## 🚨 Important Notes

- **Git Integration**: For best results, use this extension in a Git repository
- **Add Step Command**: Requires Git to track changes between steps
- **File Tracking**: Only modified files are copied to step folders (efficient storage)
- **Branch Management**: Extension creates and manages Git branches automatically

## 🔄 Typical Workflow

1. **Create breakpoint** from your project folder
2. **Develop features** incrementally
3. **Add steps** after each major change
4. **Finish breakpoint** to generate documentation
5. **Push main** to share with students
6. **Students use change logs** to follow your teaching progression

## 🎯 Perfect For

- **React/Vue/Angular tutorials**
- **API development workshops**
- **Database integration lessons**
- **Testing and deployment training**
- **Any step-by-step coding instruction**

## 💡 Tips

- Use descriptive step names (e.g., "add-user-authentication", "implement-error-handling")
- Commit your work regularly for better change tracking
- The extension works with any programming language or framework
- Generated change logs are perfect for student handouts

## 🆘 Support

If you encounter issues:
1. Ensure you're in a Git repository
2. Check that your workspace has proper folder structure
3. Verify Git is properly configured in your environment

---

**Happy Teaching! 🚀**

*Created for educators who want to provide detailed, trackable learning experiences.*


### Packaging and Installing the Extension

```sh
npm i -g vsce 
vsce  package
```  

On the Extensions tab in VSCode, hit the ellipses and "Install From VSIX..."


### How to Use the `create_gbtk.py` Script

1.  **Save the Code**: Save the Python script as a file named `create_gbtk.py`.

2.  **Organize Your Token Folder**: Before running the script, your tokens must be organized in a specific folder structure. The main folder can have any name, but inside it, there must be a subfolder named exactly `tokens` containing your image files.

    **Correct Structure:**
    ```
    my_fantasy_pack/
    └── tokens/
        ├── goblin.svg
        ├── dragon.png
        └── skeleton.jpg
    ```

3.  **Run the Script from Your Terminal**:
    Open your terminal or command prompt, navigate to the directory where you saved the script, and run it by providing the path to your main token pack folder.

    ```bash
    python create_gbtk.py path/to/my_fantasy_pack
    ```

4.  **Follow the Interactive Prompts**:
    * If the script does not find a `pack.json` file in your folder, it will guide you through creating one by asking for the pack's name, author, and description.
    * It will then list each image file found in the `tokens/` subfolder and ask you to provide a display name for it, suggesting a name based on the filename.

5.  **Done!**: The script will create a new `.gbtk` file (e.g., `my_fantasy_pack.gbtk`) in the directory *above* your pack folder. You can now load this file into Gamebook Studio.

6.  **Validate**: You can validate an existing tokens pack by running the script with the switch `--validate`, as in this example: `python create_gbtk.py --validate ./my_pack.gbtk`. The script will check the json schemas and data types, and if the token files are actually present, and output the results.
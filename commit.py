import os

name = input("Commit name: ")
os.system('npm install')
os.system('git add .')
os.system('git commit -m "' + name + '"')
os.system('git push heroku main')
os.system('git push origin main')
os.system('echo Successfully committed ' + name)

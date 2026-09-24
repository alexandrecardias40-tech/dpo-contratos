with open('dashboard/src/App.tsx', 'r') as f:
    code = f.read()

code = code.replace('[records, search, filtSit, filtAlerta, filtMod, sortBy]', '[records, search, filtSit, filtAlerta, filtMod, sortBy, filtMes]')

# Check if Status header is removed completely
code = code.replace('{["Status","Favorecido', '{["Favorecido')

with open('dashboard/src/App.tsx', 'w') as f:
    f.write(code)
